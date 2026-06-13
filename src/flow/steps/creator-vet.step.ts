import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import type { CreatorVetConfig } from '../step.entity';
import { BaseStep } from './base.step';

export class CreatorVetStep extends BaseStep<CreatorVetConfig> {
  async execute(context: FlowContext): Promise<ExecuteStepOutput> {
    const handles = this.resolvePath(this.config.handlesPath, context) as string[];
    if (!Array.isArray(handles) || handles.length === 0) return { output: { creators: [] } };

    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const minFollowers = this.config.minFollowers ?? 1000;
    const topN = this.config.topN ?? 10;
    const creators: any[] = [];

    for (const handle of handles.slice(0, 30)) {
      try {
        let profile: any;
        if (token) {
          const res = await fetch(
            `https://graph.facebook.com/v20.0/${handle}?fields=name,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${token}`,
          );
          if (res.ok) profile = await res.json();
        }
        if (!profile) {
          const res = await fetch(`https://www.instagram.com/${handle}/?__a=1&__d=dis`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          if (res.ok) { try { profile = await res.json(); } catch { } }
        }
        if (!profile) continue;

        const followerCount = profile.followers_count ?? profile.graphql?.user?.edge_followed_by?.count ?? 0;
        if (followerCount < minFollowers) continue;

        const followerScore = Math.min(40, Math.log10(followerCount + 1) * 10);
        const bioScore = Math.min(30, (profile.biography?.length ?? 0) / 5);
        const verifiedScore = profile.is_verified ? 30 : 0;

        creators.push({
          handle,
          fullName: profile.name ?? handle,
          bio: profile.biography ?? '',
          followerCount,
          followingCount: profile.follows_count ?? 0,
          postCount: profile.media_count ?? 0,
          isVerified: !!profile.is_verified,
          profilePicUrl: profile.profile_picture_url ?? '',
          score: Math.round(followerScore + bioScore + verifiedScore),
        });
      } catch { }
    }

    return { output: { creators: creators.sort((a, b) => b.score - a.score).slice(0, topN) } };
  }
}
