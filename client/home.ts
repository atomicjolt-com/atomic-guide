const main = document.getElementById('main-content');
if (!main) {
  console.error('Main content element not found');
  throw new Error('Main content element not found');
}
main.innerHTML = `
  <div class="hero-actions">
    Register a Hello World LTI tool using <a href="https://www.imsglobal.org/spec/lti-dr/v1p0">Dynamic Registration</a>.
    <h3>Dynamic Registration URL:</h3>
    <code>https://atomic-guide.atomicjolt.win/lti/register</code>

    <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center;">
      <a href="/auth/login" class="aj-btn" style="background-color: #000; color: #fff; border-color: #000;">
        Login
      </a>
      <a href="/auth/signup" class="aj-btn" style="background-color: rgb(255, 221, 0); color: #000; border-color: rgb(255, 221, 0);">
        Sign Up
      </a>
    </div>
  </div>
`;
