import { IntegrationValidationError } from '@jupiterone/integration-sdk-core';

export default function validateInvocation() {
  throw new IntegrationValidationError('Failed to access provider api');
}
