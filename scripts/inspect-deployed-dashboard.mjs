async function inspect() {
  const res = await fetch('https://wapcentral-prod.web.app/index.html');
  const text = await res.text();
  console.log('Index HTML length:', text.length);
  const matches = [...text.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
  console.log('Scripts:', matches);

  for (const scriptUrl of matches) {
    const fullUrl = scriptUrl.startsWith('http') ? scriptUrl : `https://wapcentral-prod.web.app${scriptUrl}`;
    console.log('\nFetching', fullUrl);
    const jsRes = await fetch(fullUrl);
    const jsText = await jsRes.text();
    console.log('Length:', jsText.length);
    if (jsText.includes('/notifications/')) {
      console.log('Found /notifications/ in', fullUrl);
      const matchPos = jsText.indexOf('/notifications/');
      console.log('Snippet around /notifications/:', jsText.substring(Math.max(0, matchPos - 200), Math.min(jsText.length, matchPos + 300)));
    }
  }
}

inspect().catch(console.error);
