const t = document.getElementById('main-content');
if (!t) throw (console.error('Main content element not found'), new Error('Main content element not found'));
t.innerHTML = `
  <div class="hero-actions">
    Register a Hello World LTI tool using <a href="https://www.imsglobal.org/spec/lti-dr/v1p0">Dynamic Registration</a>.
    <h3>Dynamic Registration URL:</h3>
    <code>https://atomic-guide.atomicjolt.win/lti/register</code>
  </div>
`;
