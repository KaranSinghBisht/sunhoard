const quiet = import.meta.env.PROD;

export function log(message: string): void {
  if (!quiet) {
    console.info(message);
  }
}
