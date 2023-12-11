type ValidScopes = 'openid' | 'profile' | 'email' | 'verification' | 'credentials' | 'age' | 'premium' | 'roles';
type ValidIncludes = 'name' | 'displayName' | 'avatar' | 'description' | 'created' | 'hasVerifiedBadge';
type ValidChecks = 'pkce' | 'state';
interface RobloxProviderOptions {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUri: string;
  scopes: ValidScopes[];
  include?: ValidIncludes[];
  checks?: ValidChecks;
  rest?: any;
}

// [ DATA FETCHING ] /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export default async function fetchData(url: string) {
  /* @ts-expect-error */
  const res: any = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) return false;
  return res.json();
}

async function getAvatar(id: number) {
  return (
    await fetchData(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=720x720&format=Png&isCircular=false`,
    )
  ).data[0].imageUrl;
}

async function getUserData(id: number) {
  return await fetchData(`https://users.roblox.com/v1/users/${id}`);
}

async function getExtraIncludes(id: number, includeAvatar: boolean) {
  const [USER_DATA, AVATAR] = await Promise.all([getUserData(id), getAvatar(id)]);

  return {
    avatar: AVATAR,
    description: USER_DATA.description,
    created: USER_DATA.created,
    hasVerifiedBadge: USER_DATA.hasVerifiedBadge,
  };
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const RobloxProvider = (options: RobloxProviderOptions) => {
  const {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    scopes: SCOPES,
    include: INCLUDE = ["name", "displayName", "avatar"],
    redirectUri: REDIRECT_URI,
    checks: CHECKS = ['pkce', 'state'],
    rest: REST,
  } = options;

  return {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    id: 'roblox',
    name: 'Roblox',
    type: 'oauth',
    wellKnown: 'https://apis.roblox.com/oauth/.well-known/openid-configuration',
    authorization: { params: { scope: SCOPES.join(' '), redirect_uri: REDIRECT_URI } },
    idToken: true,
    checks: CHECKS,

    client: {
      authorization_signed_response_alg: 'ES256',
      id_token_signed_response_alg: 'ES256',
    },

    profile(profile: any) {
      return {
        type: 'roblox',
        id: profile.sub,
        name: profile.preferred_username,
        displayName: profile.nickname,
        include: INCLUDE,
      };
    },

    ...REST,
  };
};

export const RobloxProviderJwtCallback = async (token: any, user: any) => {
  if (!user) return token;
  if (!(user?.type === 'roblox')) return token;

  token.id = user.id;
  token.name = undefined;

  const INCLUDE = user.include;
  if (!INCLUDE) return token;
  token.name = INCLUDE.includes('name') ? user.name : undefined;
  token.displayName = INCLUDE.includes('displayName') ? user.displayName : undefined;

  const EXTRA_DATA: any = await getExtraIncludes(user.id, INCLUDE?.avatar);
  token.avatar = INCLUDE.includes('avatar') ? EXTRA_DATA?.avatar : undefined;
  token.description = INCLUDE.includes('description') ? EXTRA_DATA?.description : undefined;
  token.created = INCLUDE?.includes('created') ? EXTRA_DATA?.created : undefined;
  token.hasVerifiedBadge = INCLUDE.includes('hasVerifiedBadge') ? EXTRA_DATA?.hasVerifiedBadge : undefined;
  token.type = 'roblox';

  return token;
};

export const RobloxProviderSessionCallback = async (session: any, tokenOrUser: any) => {
  if (!(tokenOrUser?.type === 'roblox')) return session;

  session.user.id = tokenOrUser.id;
  session.user.name = tokenOrUser.name;
  session.user.displayName = tokenOrUser.displayName;
  session.user.avatar = tokenOrUser.avatar;
  session.user.description = tokenOrUser.description;
  session.user.created = tokenOrUser.created;
  session.user.hasVerifiedBadge = tokenOrUser.hasVerifiedBadge;

  return session;
};

export const RobloxProviderCallbacks_Jwt = {
  async jwt({ token, user }: { token: any; user: any }) {
    return await RobloxProviderJwtCallback(token, user);
  },

  async session({ session, token }: { session: any; token: any }) {
    return await RobloxProviderSessionCallback(session, token);
  },
};

export const RobloxProviderCallbacks_Database = {
  async session({ session, user }: { session: any; user: any }) {
    return await RobloxProviderSessionCallback(session, user);
  },
};
