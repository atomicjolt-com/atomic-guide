import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ltiLaunch } from '@atomicjolt/lti-client';
import type { LaunchSettings } from '@atomicjolt/lti-client';
import { configureStore, setJwt } from './store';
import { ChatFAB } from './components/chat/ChatFAB';
import { ChatWindow } from './components/chat/ChatWindow';
import { LTI_NAMES_AND_ROLES_PATH, LTI_SIGN_DEEP_LINK_PATH } from '../definitions';

declare global {
  interface Window {
    LAUNCH_SETTINGS: LaunchSettings;
  }
}

const App: React.FC<{ jwt?: string }> = () => {
  return (
    <>
      <h1>Chat</h1>
      <ChatFAB />
      <ChatWindow />
    </>
  );
};

const launchSettings: LaunchSettings = window.LAUNCH_SETTINGS;

ltiLaunch(launchSettings).then((valid) => {
  if (valid) {
    const mainContent = document.getElementById('main-content');

    if (!mainContent) {
      console.error('Main content element not found');
      return;
    }

    const jwt = launchSettings.jwt;

    const store = configureStore({
      jwt,
      settings: launchSettings,
    });

    if (jwt) {
      store.dispatch(setJwt({ token: jwt }));
    }

    const root = createRoot(mainContent);
    root.render(
      <Provider store={store}>
        <App jwt={jwt} />
      </Provider>,
    );

    if (launchSettings.deepLinking) {
      const deepLinkingSetup = () => {
        const deepLinkingButton = document.getElementById('deep-linking-button');
        if (deepLinkingButton) {
          deepLinkingButton.addEventListener('click', () => {
            let deepLink: any = {
              type: 'image',
              title: 'Atomic Jolt',
              text: 'Atomic Jolt Logo',
              url: 'https://atomic-guide.atomicjolt.win/images/atomicjolt_name.png',
            };

            if (launchSettings.deepLinking?.accept_types) {
              if (launchSettings.deepLinking.accept_types.indexOf('html') >= 0) {
                deepLink = {
                  type: 'html',
                  html: '<h2>Just saying hi!</h2>',
                  title: 'Hello World',
                  text: 'A simple hello world example',
                };
              } else if (launchSettings.deepLinking.accept_types.indexOf('link') >= 0) {
                deepLink = {
                  type: 'link',
                  title: 'Atomic Jolt',
                  text: 'Atomic Jolt Home Page',
                  url: 'https://atomicjolt.com',
                };
              }
            }

            fetch('/' + LTI_SIGN_DEEP_LINK_PATH, {
              method: 'POST',
              body: JSON.stringify([deepLink]),
              headers: {
                Authorization: `Bearer ${jwt}`,
                'Content-Type': 'application/json',
              },
            })
              .then((response) => response.json())
              .then((d: any) => {
                const data = JSON.parse(d);
                const form = document.getElementById('deep-linking-form') as HTMLFormElement;
                form?.setAttribute('action', launchSettings.deepLinking?.deep_link_return_url || '');
                const field = document.getElementById('deep-link-jwt');
                field?.setAttribute('value', data.jwt);
                form?.submit();
              })
              .catch((error) => {
                console.error('Error:', error);
              });
          });
        }
      };

      setTimeout(deepLinkingSetup, 100);
    }

    fetch(`/${LTI_NAMES_AND_ROLES_PATH}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    })
      .then((response) => response.json())
      .then((data) => console.log(data))
      .catch((error) => {
        console.error('Error:', error);
      });
  } else {
    document.body.innerHTML = 'Failed to launch';
  }
});
