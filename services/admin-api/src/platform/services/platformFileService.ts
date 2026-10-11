import type {
  ClassifiedFileItem,
  FileMatchResult,
  PlatformExecutionSource,
  PlatformFileClassifyRequest,
  PlatformFileClassifyResponse,
  PlatformFileSearchRequest,
  PlatformFileSearchResponse,
} from '@wapcentral/types';

/**
 * Extracts intent, dates, and keywords from natural-language search queries.
 * Examples: "2025 ka electricity bill dhundo", "tax statement 2024", "passport scan"
 */
function parseSearchQuery(query: string): {
  category?: string | undefined;
  targetYear?: number | undefined;
  targetMonth?: string | undefined;
  documentType?: string | undefined;
  keywords: string[];
} {
  const qLower = query.toLowerCase();

  // Extract Year
  const yearMatch = qLower.match(/\b(20\d\d)\b/);
  const targetYear = yearMatch ? parseInt(yearMatch[1]!, 10) : undefined;

  // Extract Month
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  ];
  let targetMonth: string | undefined = undefined;
  for (const m of months) {
    if (new RegExp(`\\b${m}\\b`).test(qLower)) {
      targetMonth = m;
      break;
    }
  }

  // Detect Categories
  let category: string | undefined = undefined;
  let documentType: string | undefined = undefined;

  if (qLower.includes('bill') || qLower.includes('electricity') || qLower.includes('bijli') || qLower.includes('utility')) {
    category = 'bills_receipts';
    documentType = 'electricity_bill';
  } else if (qLower.includes('salary') || qLower.includes('payslip') || qLower.includes('wage')) {
    category = 'financial';
    documentType = 'salary_slip';
  } else if (qLower.includes('tax') || qLower.includes('itr') || qLower.includes('gst')) {
    category = 'financial';
    documentType = 'tax_document';
  } else if (qLower.includes('passport') || qLower.includes('aadhaar') || qLower.includes('pan') || qLower.includes('id')) {
    category = 'legal';
    documentType = 'identity_card';
  } else if (qLower.includes('medical') || qLower.includes('prescription') || qLower.includes('doctor')) {
    category = 'medical';
    documentType = 'medical_report';
  }

  // Tokenize keywords (filter stop words)
  const stopWords = new Set(['ka', 'ki', 'ke', 'dhundo', 'search', 'find', 'show', 'the', 'a', 'an', 'in', 'of', 'for', 'to']);
  const tokens = qLower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !stopWords.has(t));

  return {
    category,
    targetYear,
    targetMonth,
    documentType,
    keywords: tokens,
  };
}

export async function executeFileSearch(
  req: PlatformFileSearchRequest,
  _requestId: string,
): Promise<{
  data: PlatformFileSearchResponse;
  executionSource: PlatformExecutionSource;
  usage: { processingVolumeBytes: number; latencyMs: number };
}> {
  const startTime = Date.now();
  const parsedIntent = parseSearchQuery(req.query);
  const matchedFiles: FileMatchResult[] = [];

  // Match against client-supplied metadata candidates (Privacy First: local candidates only)
  if (req.localCandidates && req.localCandidates.length > 0) {
    for (const file of req.localCandidates) {
      const fileNameLower = file.name.toLowerCase();
      const snippetLower = (file.extractedSnippet || '').toLowerCase();
      const tags = (file.tags || []).map((t) => t.toLowerCase());

      let score = 0;
      const reasons: string[] = [];

      // Year match
      if (parsedIntent.targetYear) {
        const yearStr = String(parsedIntent.targetYear);
        if (fileNameLower.includes(yearStr) || snippetLower.includes(yearStr)) {
          score += 30;
          reasons.push(`Contains target year ${parsedIntent.targetYear}`);
        }
      }

      // Keyword matches
      for (const kw of parsedIntent.keywords) {
        if (fileNameLower.includes(kw)) {
          score += 25;
          reasons.push(`File name matches keyword '${kw}'`);
        } else if (tags.includes(kw)) {
          score += 20;
          reasons.push(`Tag matches keyword '${kw}'`);
        } else if (snippetLower.includes(kw)) {
          score += 15;
          reasons.push(`Content snippet matches keyword '${kw}'`);
        }
      }

      // Category / Document type match
      if (parsedIntent.documentType && fileNameLower.includes(parsedIntent.documentType.replace('_', ' '))) {
        score += 25;
        reasons.push(`Matches document type '${parsedIntent.documentType}'`);
      }

      if (score > 0) {
        matchedFiles.push({
          fileId: file.id,
          fileName: file.name,
          relevanceScore: Math.min(100, score),
          matchedSnippet: file.extractedSnippet?.substring(0, 100),
          categoryMatched: parsedIntent.category,
          reasons,
        });
      }
    }

    // Sort descending by relevance score
    matchedFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Generate recommended local filters so FileZen can query on-device instantly
  const recommendedLocalFilters = {
    extensionIn: ['pdf', 'jpg', 'jpeg', 'png'],
    dateAfter: parsedIntent.targetYear ? `${parsedIntent.targetYear}-01-01` : undefined,
    dateBefore: parsedIntent.targetYear ? `${parsedIntent.targetYear}-12-31` : undefined,
    regexPattern: parsedIntent.keywords.length > 0 ? `(${parsedIntent.keywords.join('|')})` : undefined,
  };

  const latencyMs = Date.now() - startTime;

  return {
    data: {
      query: req.query,
      parsedIntent,
      matchedFiles: matchedFiles.slice(0, req.limit || 20),
      recommendedLocalFilters,
    },
    executionSource: 'wap_engine',
    usage: {
      processingVolumeBytes: req.query.length + (req.localCandidates?.length || 0) * 100,
      latencyMs,
    },
  };
}

export async function executeFileClassify(
  req: PlatformFileClassifyRequest,
  _requestId: string,
): Promise<{
  data: PlatformFileClassifyResponse;
  executionSource: PlatformExecutionSource;
  usage: { processingVolumeBytes: number; latencyMs: number };
}> {
  const startTime = Date.now();
  const results: ClassifiedFileItem[] = [];
  const seenSizes = new Map<number, string>();

  for (const file of req.files) {
    const nameLower = file.name.toLowerCase();
    const ext = file.extension?.toLowerCase() || nameLower.split('.').pop() || '';
    const sample = (file.sampleText || '').toLowerCase();

    let category: ClassifiedFileItem['category'] = 'other';
    const suggestedTags: string[] = [];

    // Classification heuristics
    if (
      nameLower.includes('bill') ||
      nameLower.includes('receipt') ||
      nameLower.includes('invoice') ||
      sample.includes('amount due') ||
      sample.includes('tax invoice')
    ) {
      category = 'bills_receipts';
      suggestedTags.push('bill', 'payment');
      if (nameLower.includes('electricity') || sample.includes('kwh')) suggestedTags.push('electricity', 'utility');
      if (nameLower.includes('water')) suggestedTags.push('water', 'utility');
    } else if (
      nameLower.includes('salary') ||
      nameLower.includes('bank') ||
      nameLower.includes('tax') ||
      nameLower.includes('statement') ||
      sample.includes('account number')
    ) {
      category = 'financial';
      suggestedTags.push('finance', 'banking');
      if (nameLower.includes('salary')) suggestedTags.push('payslip');
      if (nameLower.includes('tax')) suggestedTags.push('tax', 'itr');
    } else if (
      nameLower.includes('contract') ||
      nameLower.includes('agreement') ||
      nameLower.includes('passport') ||
      nameLower.includes('license')
    ) {
      category = 'legal';
      suggestedTags.push('legal', 'document');
    } else if (
      nameLower.includes('medical') ||
      nameLower.includes('prescription') ||
      nameLower.includes('lab') ||
      sample.includes('diagnosis')
    ) {
      category = 'medical';
      suggestedTags.push('health', 'medical');
    } else if (
      ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov'].includes(ext)
    ) {
      category = 'media';
      suggestedTags.push('media', ext);
    } else if (
      ['doc', 'docx', 'ppt', 'pptx', 'xlsx', 'xls', 'pdf'].includes(ext)
    ) {
      category = 'work';
      suggestedTags.push('document', ext);
    }

    // Duplicate detection heuristic (size match)
    let isDuplicateCandidate = false;
    let duplicateOfId: string | undefined = undefined;

    if (file.sizeBytes && file.sizeBytes > 1000) {
      const existingId = seenSizes.get(file.sizeBytes);
      if (existingId) {
        isDuplicateCandidate = true;
        duplicateOfId = existingId;
      } else {
        seenSizes.set(file.sizeBytes, file.id);
      }
    }

    results.push({
      id: file.id,
      name: file.name,
      category,
      suggestedTags,
      confidence: category === 'other' ? 0.5 : 0.92,
      isDuplicateCandidate,
      duplicateOfId,
    });
  }

  const latencyMs = Date.now() - startTime;

  return {
    data: {
      results,
      totalClassified: results.length,
    },
    executionSource: 'wap_engine',
    usage: {
      processingVolumeBytes: req.files.length * 200,
      latencyMs,
    },
  };
}
