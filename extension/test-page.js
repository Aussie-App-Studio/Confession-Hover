/**
 * Confession Hover — Verification Page Dynamic Test Script
 */
(function () {
  const btn = document.getElementById('addDynamicContent');
  const container = document.getElementById('dynamicContainer');
  if (!btn || !container) return;

  let count = 0;
  const snippets = [
    'Dynamically added Reformed reflection on WCF 1.1 and Heidelberg Catechism Q. 1 (Lord\'s Day 1).',
    'Compare 2LBCF 26.1 with Belgic Confession Art. 29 and Canons of Dort 3/4.3.',
    'Review Canons of Dort 1.R.3 alongside WSC 33 and WLC 70.'
  ];

  btn.addEventListener('click', () => {
    const p = document.createElement('p');
    p.style.padding = '10px 14px';
    p.style.background = '#f4f1f2';
    p.style.borderRadius = '8px';
    p.style.border = '1px solid #e4e4e7';
    p.textContent = snippets[count % snippets.length];
    container.appendChild(p);
    count++;
  });
})();
