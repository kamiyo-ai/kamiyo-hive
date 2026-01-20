import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      twitterId?: string;
      twitterUsername?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    twitterId?: string;
    twitterUsername?: string;
  }
}
