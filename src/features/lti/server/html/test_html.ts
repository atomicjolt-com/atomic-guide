import { html } from '@atomicjolt/lti-endpoints';
import viteHmrHtml from '../../../../shared/server/html/vite_hmr_html.js';
import { LaunchSettings } from '@atomicjolt/lti-client';

// This page is meant to simulate the LTI launch process for quick testing purposes

const launchSettings: LaunchSettings = {
  stateVerified: true,
  state: 'test-state',
  ltiStorageParams: {
    platformOIDCUrl: 'https://example.com/oidc',
  },
};

export default function testHtml(scriptName: string) {
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
    Hello World
    </div>
    <script type="module" src="/${scriptName}"></script>
  `;
  return html(head, body);
}
