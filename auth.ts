import NextAuth from 'next-auth';
import Twitter from 'next-auth/providers/twitter';

interface TwitterProfile {
  data?: {
    id?: string;
    username?: string;
  };
  id?: string;
  username?: string;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Twitter({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const twitterProfile = profile as TwitterProfile;
        token.twitterId = twitterProfile.data?.id ?? twitterProfile.id;
        token.twitterUsername = twitterProfile.data?.username ?? twitterProfile.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.twitterId = token.twitterId as string;
        session.user.twitterUsername = token.twitterUsername as string;
      }
      return session;
    },
  },
});
