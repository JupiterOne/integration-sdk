import { IntegrationValidationError } from '../../../../framework';

export default function validateInvocation() {
  throw new IntegrationValidationError('Failed to access provider api');
}
