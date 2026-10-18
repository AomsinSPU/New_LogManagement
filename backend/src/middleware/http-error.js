export function httpError(status) {
  return Object.assign(new Error('Request rejected'), { status });
}