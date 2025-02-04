interface AuthConfig {
  githubToken: string;
}

export class Auth {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  async getGitHubToken(): Promise<string> {
    return this.config.githubToken;
  }

  async validateToken(token: string): Promise<boolean> {
    return token === this.config.githubToken;
  }
}

export const auth = new Auth({
  githubToken: process.env.GITHUB_TOKEN || ''
}); 