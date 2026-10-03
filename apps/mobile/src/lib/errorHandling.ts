/**
 * Utility for handling and parsing tRPC errors from the wholesale validation.
 */

export interface FieldErrors {
  [fieldName: string]: string;
}

/**
 * Checks if an error is a tRPC validation error.
 */
export function isTRPCValidationError(error: unknown): error is { data?: { zodError?: { fieldErrors?: Record<string, string[]> } } } {
  if (error && typeof error === 'object') {
    const anyError = error as any;
    return (
      anyError.data?.code === 'BAD_REQUEST' ||
      (anyError.data?.zodError && typeof anyError.data.zodError === 'object')
    );
  }
  return false;
}

/**
 * Extracts field-level errors from a tRPC validation error.
 * Returns an object mapping field names to error messages.
 */
export function extractFieldErrors(error: unknown): FieldErrors {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const anyError = error as any;

  // Handle tRPC errors with Zod validation details
  if (anyError.data?.zodError?.fieldErrors) {
    const fieldErrors: FieldErrors = {};
    const zodErrors = anyError.data.zodError.fieldErrors as Record<string, string[]>;

    for (const [field, messages] of Object.entries(zodErrors)) {
      if (Array.isArray(messages) && messages.length > 0) {
        fieldErrors[field] = messages[0]; // Take the first error message
      }
    }

    return fieldErrors;
  }

  return {};
}

/**
 * Gets a user-friendly error message from any error type.
 */
export function getErrorMessage(error: unknown): string {
  if (!error) {
    return 'Please try again.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object') {
    const anyError = error as any;

    // Handle tRPC errors
    if (anyError.message) {
      return anyError.message;
    }

    if (anyError.data?.message) {
      return anyError.data.message;
    }
  }

  return 'Please try again.';
}

/**
 * Checks if an error appears to be a server error (non-validation).
 */
export function isServerError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const anyError = error as any;
  return !anyError.data?.zodError && !isTRPCValidationError(error);
}
