declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    INITIAL_WORKSPACE_JSON?: string;
    BUCKET?: R2Bucket;
  }
}
