/**
 * Brand utility for nominal typing.
 * Usage: type BlockId = Brand<string, 'BlockId'>
 */
export type Brand<T, B> = T & { readonly __brand: B };
