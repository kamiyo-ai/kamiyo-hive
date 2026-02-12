declare module '@radr/shadowwire' {
  export class ShadowWireClient {
    constructor(config?: { debug?: boolean });
    getBalance(wallet: string, token: string): Promise<{ available: number; poolAddress: string }>;
    deposit(params: { wallet: string; amount: number; token: string }): Promise<{ transaction: unknown }>;
    withdraw(params: { wallet: string; amount: number; token: string }): Promise<{ transaction: unknown }>;
    transfer(params: {
      sender: string;
      recipient: string;
      amount: number;
      token: string;
      type: string;
    }): Promise<{ success: boolean; signature?: string; error?: string }>;
  }
}
