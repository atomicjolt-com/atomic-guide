import { html } from '@atomicjolt/lti-endpoints';
import viteHmrHtml from './vite_hmr_html';
import { LaunchSettings } from '@atomicjolt/lti-client';

// This page is for embedding Atomic Guide into external webpages

const launchSettings: LaunchSettings = {
  stateVerified: true,
  state: 'embed-state',
  ltiStorageParams: {
    platformOIDCUrl: 'https://example.com/oidc',
  },
};

export default function embedHtml(scriptName: string) {
  const head = `
    ${viteHmrHtml()}
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
    <link href="/styles.css" rel="stylesheet">
    <script type="text/javascript">
      window.LAUNCH_SETTINGS = ${JSON.stringify(launchSettings)};
      window.IS_EMBEDDED = true;
    </script>
    <style>
      /* Embed-specific styles for seamless integration */
      body {
        margin: 0;
        padding: 0;
        background: transparent;
      }
      #main-content {
        width: 100%;
        height: 100vh;
        overflow: auto;
      }
    </style>
  `;
  const body = `
    <div id="error" class="hidden u-flex aj-centered-message">
      <i class="material-icons-outlined aj-icon" aria-hidden="true">warning</i>
      <p class="aj-text translate">
        There was an error loading Atomic Guide. Please reload and try again.
      </p>
    </div>
    <div id="main-content">
      <!-- Atomic Guide will be loaded here -->
    </div>
    <script type="module" src="/${scriptName}"></script>
  `;
  return html(head, body);
}
