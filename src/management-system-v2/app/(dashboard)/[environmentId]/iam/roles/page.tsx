import { getCurrentEnvironment } from '@/components/auth';
import Content from '@/components/content';
import { getRoles } from '@/lib/data/legacy/iam/roles';
import RolesPage from './role-page';
import UnauthorizedFallback from '@/components/unauthorized-fallback';
import { ComponentProps } from 'react';
import { getUserById } from '@/lib/data/legacy/iam/users';

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const { ability, activeEnvironment } = await getCurrentEnvironment(params.environmentId);

  if (!ability.can('manage', 'Role')) return <UnauthorizedFallback />;

  const roles = getRoles(activeEnvironment.spaceId, ability);

  for (let i = 0; i < roles.length; i++) {
    // @ts-ignore
    roles[i] = { members: roles[i].members.map(({ userId }) => getUserById(userId)), ...roles[i] };
  }

  return (
    <Content title="Identity and Access Management">
      <RolesPage roles={roles as ComponentProps<typeof RolesPage>['roles']} />
    </Content>
  );
};

export default Page;
