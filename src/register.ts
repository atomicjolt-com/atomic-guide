import { HandlePlatformResponse } from '@atomicjolt/lti-endpoints/dist/handlers/dynamic_registration_finish';
import { RegistrationConfiguration, LTI_TOOL_CONFIGURATION } from '@atomicjolt/lti-types';
import { DatabaseService } from './services/database';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Handle platform response from dynamic registration
 * Creates or updates tenant record in D1 database
 */
export const handlePlatformResponse: HandlePlatformResponse = async(
  registrationConfiguration: RegistrationConfiguration,
  env?: any
) => {
  console.log('--------------------------------------------------------');
  console.log('Processing registration configuration:', registrationConfiguration);

  // Check if we have database access
  if (!env?.DB) {
    console.error('Database not available in environment');
    return null;
  }

  try {
    const db = env.DB as D1Database;
    const dbService = new DatabaseService(db);

    // Extract required fields from registration
    const clientId = registrationConfiguration.client_id;
    const toolConfig = registrationConfiguration[LTI_TOOL_CONFIGURATION];
    
    if (!clientId || !toolConfig) {
      console.error('Missing required registration fields');
      return null;
    }

    // Get platform information from the tool configuration
    const iss = toolConfig.oidc_initiation_url?.split('/')[2] || 'unknown';
    const deploymentId = toolConfig.deployment_id;
    
    // Create or update tenant record
    const tenant = await dbService.createTenant(
      iss,
      clientId,
      toolConfig.institution_name || 'Unknown Institution',
      toolConfig.lms || 'canvas', // Default to Canvas if not specified
      toolConfig.target_link_uri || iss,
      deploymentId ? [deploymentId] : []
    );

    console.log('Tenant created/updated:', tenant.id);

    // If we have a deployment ID and the tenant already existed, add it to the list
    if (deploymentId && tenant.deployment_ids) {
      const deploymentIds = [...new Set([...tenant.deployment_ids, deploymentId])];
      if (deploymentIds.length > tenant.deployment_ids.length) {
        await dbService.updateTenantDeploymentIds(tenant.id, deploymentIds);
        console.log('Added deployment ID to tenant:', deploymentId);
      }
    }

    return {
      success: true,
      tenantId: tenant.id,
      message: 'Registration processed successfully'
    };

  } catch (error) {
    console.error('Error handling platform response:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};