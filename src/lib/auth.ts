import { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [],
  // @ts-ignore
  adapter: {
    db: {
      url: process.env.MONGODB_URI,
    },
  },
};