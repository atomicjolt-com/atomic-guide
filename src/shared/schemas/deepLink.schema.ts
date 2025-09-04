/**
 * @fileoverview Deep link validation schemas for LTI deep linking operations.
 * Provides type-safe schemas for deep link content items and API responses.
 * @module shared/schemas/deepLink
 */

import { z } from 'zod';

/**
 * HTML deep link content schema.
 * Used for embedding HTML content directly in the platform.
 */
export const htmlDeepLinkSchema = z.object({
  type: z.literal('html'),
  html: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
});

/**
 * Link deep link content schema.
 * Used for creating external links in the platform.
 */
export const linkDeepLinkSchema = z.object({
  type: z.literal('link'),
  title: z.string().min(1),
  text: z.string().min(1),
  url: z.string().url(),
});

/**
 * Image deep link content schema.
 * Used for embedding images in the platform.
 */
export const imageDeepLinkSchema = z.object({
  type: z.literal('image'),
  title: z.string().min(1),
  text: z.string().min(1),
  url: z.string().url(),
});

/**
 * Union schema for all deep link types.
 * Allows type-safe discrimination between different content types.
 */
export const deepLinkSchema = z.discriminatedUnion('type', [htmlDeepLinkSchema, linkDeepLinkSchema, imageDeepLinkSchema]);

/**
 * Inferred TypeScript types from schemas.
 */
export type HtmlDeepLink = z.infer<typeof htmlDeepLinkSchema>;
export type LinkDeepLink = z.infer<typeof linkDeepLinkSchema>;
export type ImageDeepLink = z.infer<typeof imageDeepLinkSchema>;
export type DeepLink = z.infer<typeof deepLinkSchema>;

/**
 * Deep link API response schema.
 * Contains the signed JWT for submitting back to the platform.
 */
export const deepLinkResponseSchema = z.object({
  jwt: z.string().min(1),
});

export type DeepLinkResponse = z.infer<typeof deepLinkResponseSchema>;

/**
 * Names and roles API response schema.
 * Contains course membership information from the platform.
 */
export const namesAndRolesResponseSchema = z.object({
  members: z
    .array(
      z.object({
        user_id: z.string(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        roles: z.array(z.string()),
      })
    )
    .optional(),
  context: z
    .object({
      id: z.string(),
      label: z.string().optional(),
      title: z.string().optional(),
    })
    .optional(),
});

export type NamesAndRolesResponse = z.infer<typeof namesAndRolesResponseSchema>;
