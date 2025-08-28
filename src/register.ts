import { HandlePlatformResponse } from '@atomicjolt/lti-endpoints/dist/handlers/dynamic_registration_finish';
import { RegistrationConfiguration, LTI_TOOL_CONFIGURATION, LTI_PLATFORM_CONFIGURATION } from '@atomicjolt/lti-types';
import { DatabaseService } from './services/database';
import type { D1Database } from '@cloudflare/workers-types';
import { Context } from 'hono';

/**
 * Handle platform response from dynamic registration
 * Creates or updates tenant record in D1 database
 */
export const handlePlatformResponse: HandlePlatformResponse = async (registrationConfiguration: RegistrationConfiguration, c: Context) => {
  // Extract environment from context
  const env = c?.env;

  // Check if we have database access
  if (!env?.DB) {
    console.error('Database not available in environment', { c, env });
    return null;
  }

  try {
    const db = env.DB as D1Database;
    const dbService = new DatabaseService(db);

    // Extract the tool configuration from the response
    const toolConfig = registrationConfiguration.platformToolConfiguration[LTI_TOOL_CONFIGURATION];
    console.log('registrationConfiguration.platformToolConfiguration', registrationConfiguration.platformToolConfiguration);
    if (!toolConfig) {
      console.error('No tool configuration found in registration response');
      return {
        success: false,
        error: 'Invalid registration response: missing tool configuration',
      };
    }

    // Extract required fields from registration
    const iss = registrationConfiguration.platformConfiguration.issuer;
    const clientId = registrationConfiguration.platformToolConfiguration.client_id || '';
    const deploymentIds: string[] = toolConfig.deployment_id ? [toolConfig.deployment_id] : [];

    // Extract institution info from registration
    const institutionName = registrationConfiguration.platformToolConfiguration?.client_name || 'Unknown Institution';
    const lmsUrl = toolConfig.target_link_uri || iss;
    const ltiPlatformConfig = registrationConfiguration.platformConfiguration[LTI_PLATFORM_CONFIGURATION];
    const lmsType = ltiPlatformConfig?.product_family_code || 'unknown';

    // Search for existing tenant
    let tenant = await dbService.findTenantByIssAndClientId(iss, clientId);
    if (tenant) {
      // Update existing tenant with all available fields
      await dbService.updateTenant(tenant.id, {
        deployment_ids: [...new Set([...tenant.deployment_ids, ...deploymentIds])],
        institution_name: institutionName,
        lms_type: lmsType,
        lms_url: lmsUrl,
      });
    } else {
      // Create tenant
      tenant = await dbService.createTenant(iss, clientId, institutionName, lmsType, lmsUrl, deploymentIds);
    }

    return {
      success: true,
      clientId,
      tenantId: tenant.id,
      deploymentIds,
      message: 'Registration processed successfully',
    };
  } catch (error) {
    console.error('Error handling platform response:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
