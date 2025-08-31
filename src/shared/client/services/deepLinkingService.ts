/**
 * @fileoverview Service for handling LTI deep linking operations.
 * Provides utilities for creating, signing, and submitting deep links to LTI platforms.
 * @module shared/client/services/deepLinkingService
 */

import type { LaunchSettings } from '@atomicjolt/lti-client';
import { LTI_SIGN_DEEP_LINK_PATH } from '../../../../definitions';
import { 
  deepLinkSchema, 
  deepLinkResponseSchema,
  type DeepLink,
  type DeepLinkResponse 
} from '@shared/schemas/deepLink.schema';

/**
 * Creates the appropriate deep link based on accepted types.
 * 
 * @param acceptTypes - Array of accepted content types from platform
 * @returns Default deep link object based on platform capabilities
 */
export function createDeepLink(acceptTypes?: string[]): DeepLink {
  if (!acceptTypes || acceptTypes.length === 0) {
    return deepLinkSchema.parse({
      type: 'image',
      title: 'Atomic Jolt',
      text: 'Atomic Jolt Logo',
      url: 'https://atomic-guide.atomicjolt.win/images/atomicjolt_name.png',
    });
  }

  if (acceptTypes.includes('html')) {
    return deepLinkSchema.parse({
      type: 'html',
      html: '<h2>Just saying hi!</h2>',
      title: 'Hello World',
      text: 'A simple hello world example',
    });
  }

  if (acceptTypes.includes('link')) {
    return deepLinkSchema.parse({
      type: 'link',
      title: 'Atomic Jolt',
      text: 'Atomic Jolt Home Page',
      url: 'https://atomicjolt.com',
    });
  }

  return deepLinkSchema.parse({
    type: 'image',
    title: 'Atomic Jolt',
    text: 'Atomic Jolt Logo',
    url: 'https://atomic-guide.atomicjolt.win/images/atomicjolt_name.png',
  });
}

/**
 * Signs a deep link with JWT and returns signed response.
 * 
 * @param deepLink - Deep link object to sign
 * @param jwt - Bearer token for authorization
 * @returns Promise resolving to signed deep link response
 * @throws {Error} If API request fails or response validation fails
 */
export async function signDeepLink(
  deepLink: DeepLink, 
  jwt: string
): Promise<DeepLinkResponse> {
  const response = await fetch('/' + LTI_SIGN_DEEP_LINK_PATH, {
    method: 'POST',
    body: JSON.stringify([deepLink]),
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to sign deep link: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const parsedData = JSON.parse(data);
  return deepLinkResponseSchema.parse(parsedData);
}

/**
 * Submits a signed deep link to the platform.
 * 
 * @param signedJwt - Signed JWT from deep link API
 * @param returnUrl - Platform's deep link return URL
 * @throws {Error} If form elements are not found
 */
export function submitDeepLink(signedJwt: string, returnUrl: string): void {
  const form = document.getElementById('deep-linking-form') as HTMLFormElement;
  const field = document.getElementById('deep-link-jwt') as HTMLInputElement;

  if (!form || !field) {
    throw new Error('Deep linking form elements not found');
  }

  form.setAttribute('action', returnUrl);
  field.setAttribute('value', signedJwt);
  form.submit();
}

/**
 * Sets up deep linking button handler.
 * 
 * @param launchSettings - Launch settings containing JWT and deep linking config
 * @returns Cleanup function to remove event listener
 */
export function setupDeepLinkingButton(launchSettings: LaunchSettings): (() => void) | null {
  const button = document.getElementById('deep-linking-button');
  
  if (!button || !launchSettings.jwt || !launchSettings.deepLinking?.deep_link_return_url) {
    return null;
  }

  const handleClick = async (): Promise<void> => {
    try {
      const deepLink = createDeepLink(launchSettings.deepLinking?.accept_types);
      const response = await signDeepLink(deepLink, launchSettings.jwt!);
      submitDeepLink(response.jwt, launchSettings.deepLinking!.deep_link_return_url);
    } catch (error) {
      console.error('Deep linking error:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  button.addEventListener('click', handleClick);
  
  return () => {
    button.removeEventListener('click', handleClick);
  };
}