import { html } from '@atomicjolt/lti-endpoints';
import viteHmrHtml from '../../../../shared/server/html/vite_hmr_html.js';
import { LaunchSettings } from '@atomicjolt/lti-client';

export default function launchHtml(launchSettings: LaunchSettings, scriptName: string) {
  const head = `
    ${viteHmrHtml()}
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
    <link href="/styles.css" rel="stylesheet">
    <script type="text/javascript">
      window.LAUNCH_SETTINGS = ${JSON.stringify(launchSettings)};
    </script>
  `;
  const body = `
    <div id="error" class="hidden u-flex aj-centered-message">
      <i class="material-icons-outlined aj-icon" aria-hidden="true">warning</i>
      <p class="aj-text translate">
        There was an error launching the LTI tool. Please reload and try again.
      </p>
    </div>
    <div id="main-content">
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <h1 class="loading-title">Loading Atomic Guide</h1>
        <p class="loading-subtitle">Please wait...</p>
      </div>
    </div>
    <script type="module" src="/${scriptName}"></script>
  `;
  return html(head, body);
}
