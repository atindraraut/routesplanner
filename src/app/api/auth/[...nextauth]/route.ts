import NextAuth, { NextAuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt"; 

const DUMMY_USERS: { [key: string]: { password?: string; id: string; name: string; username: string } } = {
  "admin": { id: "1", name: "admin", username: "admin", password: "password" }
};

const addDummyUser = (user: string, pass: string): void => {
  DUMMY_USERS[user] = { id: (Object.keys(DUMMY_USERS).length + 1).toString(), name: user, username: user, password: pass.toString() };
};

const dummyUsername = "admin";
const dummyPassword = "password";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",

      async authorize(credentials, req) {
        const username = credentials?.username;
        const password = credentials?.password;

        if (!username || !password) {
          return null;
        }
        const lowerCaseUsername = username.toString().toLowerCase();

        if (DUMMY_USERS[lowerCaseUsername]) {
          if (DUMMY_USERS[lowerCaseUsername].password?.toString() === password.toString()) {
            return DUMMY_USERS[lowerCaseUsername];
          }
          return null;
        } else {
          addDummyUser(lowerCaseUsername, password);
          return DUMMY_USERS[lowerCaseUsername];
        }

        return null;
      },

      credentials: {
        username: {
          label: "Username",
          placeholder: "username",
          type: "text",
        },

        password: {
          label: "Password",
          type: "password",
        },
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }: { token: JWT, user?: User }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string


      }
      return session;
    },
  },
  session: {
    strategy: "jwt"
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
