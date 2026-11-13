import type { IAuthProvider } from '@core/domain/repositories/ports';

export class LocalAuthProvider implements IAuthProvider {
  async verifyPin(_pin: string): Promise<boolean> {
    return false;
  }
  isAdmin(): boolean {
    return false;
  }
  async getSession(): Promise<{ user: any; accessToken: string } | null> {
    return null;
  }
}
