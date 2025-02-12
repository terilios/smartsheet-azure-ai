export interface Result<T> {
  success: boolean;
  result?: T;
  error?: Error;
}
