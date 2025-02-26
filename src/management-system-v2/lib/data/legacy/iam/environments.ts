import { v4 } from 'uuid';
import store from '../store.js';
import Ability, { UnauthorizedError } from '@/lib/ability/abilityHelper';
import { addRole, deleteRole, getRoleByName, getRoles, roleMetaObjects } from './roles';
import { adminPermissions } from '@/lib/authorization/permissionHelpers';
import { addRoleMappings } from './role-mappings';
import { addMember, membershipMetaObject, removeMember } from './memberships';
import {
  Environment,
  EnvironmentInput,
  UserOrganizationEnvironmentInput,
  UserOrganizationEnvironmentInputSchema,
  environmentSchema,
} from '../../environment-schema';
import { getProcessMetaObjects, removeProcess } from '../_process';
import { createFolder, deleteFolder, getRootFolder } from '../folders';
import { deleteLogo, getLogo, hasLogo, saveLogo } from '../fileHandling.js';
import { toCaslResource } from '@/lib/ability/caslAbility';
import { env } from '@/lib/env-vars.js';

// @ts-ignore
let firstInit = !global.environmentMetaObject;

export let environmentsMetaObject: { [Id: string]: Environment } =
  // @ts-ignore
  global.environmentsMetaObject || (global.environmentsMetaObject = {});

export function getEnvironments(ability?: Ability) {
  const environments = Object.values(environmentsMetaObject);

  //TODO: filter environments by ability
  return environments;
}

export async function getEnvironmentById(
  id: string,
  ability?: Ability,
  opts?: { throwOnNotFound?: boolean },
) {
  const environment = environmentsMetaObject[id];

  if (!environment && opts && opts.throwOnNotFound) throw new Error('Environment not found');

  return environment as Environment;
}

/** Sets an environment to active, and adds the given user as an admin */
export async function activateEnvrionment(environmentId: string, userId: string) {
  const environment = await getEnvironmentById(environmentId);
  if (!environment) throw new Error("Environment doesn't exist");
  if (!environment.isOrganization) throw new Error('Environment is a personal environment');
  if (environment.isActive) throw new Error('Environment is already active');

  const adminRole = await getRoleByName(environmentId, '@admin');
  if (!adminRole) throw new Error(`Consistency error: admin role of ${environmentId} not found`);

  addMember(environmentId, userId);

  addRoleMappings([
    {
      environmentId,
      roleId: adminRole.id,
      userId,
    },
  ]);
}

export async function addEnvironment(environmentInput: EnvironmentInput, ability?: Ability) {
  const newEnvironment = environmentSchema.parse(environmentInput);
  const id = newEnvironment.isOrganization ? v4() : newEnvironment.ownerId;

  if (await getEnvironmentById(id)) throw new Error('Environment id already exists');

  const newEnvironmentWithId = { ...newEnvironment, id };
  environmentsMetaObject[id] = newEnvironmentWithId;
  store.add('environments', newEnvironmentWithId);

  if (newEnvironment.isOrganization) {
    const adminRole = await addRole({
      environmentId: id,
      name: '@admin',
      default: true,
      permissions: { All: adminPermissions },
    });
    addRole({
      environmentId: id,
      name: '@guest',
      default: true,
      permissions: {},
    });
    addRole({
      environmentId: id,
      name: '@everyone',
      default: true,
      permissions: {},
    });

    if (newEnvironment.isActive) {
      await addMember(id, newEnvironment.ownerId);

      await addRoleMappings([
        {
          environmentId: id,
          roleId: adminRole.id,
          userId: newEnvironment.ownerId,
        },
      ]);
    }
  }

  // add root folder
  await createFolder({
    environmentId: id,
    name: '',
    parentId: null,
    createdBy: null,
  });

  return newEnvironmentWithId;
}

export async function deleteEnvironment(environmentId: string, ability?: Ability) {
  const environment = await getEnvironmentById(environmentId);
  if (!environment) throw new Error('Environment not found');

  if (ability && !ability.can('delete', 'Environment')) throw new UnauthorizedError();

  // NOTE: when using a db I think it would be faster to just delete processes and folders where de
  // environmentId matches
  const rootFolder = await getRootFolder(environmentId);
  if (!rootFolder) throw new Error('Root folder not found');
  await deleteFolder(rootFolder.id);

  if (environment.isOrganization) {
    const environmentMemberships = membershipMetaObject[environmentId];
    if (environmentMemberships) {
      for (const { userId } of environmentMemberships) {
        await removeMember(environmentId, userId);
      }
      delete membershipMetaObject[environmentId];
    }

    const roles = Object.values(roleMetaObjects);
    for (const role of roles) {
      if (role.environmentId === environmentId) {
        await deleteRole(role.id); // also deletes role mappings
      }
    }
  }

  delete environmentsMetaObject[environmentId];
  store.remove('environments', environmentId);
}

export async function saveOrganizationLogo(
  organizationId: string,
  image: Buffer,
  ability?: Ability,
) {
  const organization = await getEnvironmentById(organizationId, undefined, {
    throwOnNotFound: true,
  });
  if (!organization?.isOrganization)
    throw new Error("You can't save a logo for a personal environment");

  if (ability && ability.can('update', 'Environment', { environmentId: organizationId }))
    throw new UnauthorizedError();

  try {
    saveLogo(organizationId, image);
  } catch (err) {
    throw new Error('Failed to store image');
  }
}

export async function getOrganizationLogo(organizationId: string) {
  const organization = await getEnvironmentById(organizationId, undefined, {
    throwOnNotFound: true,
  });
  if (!organization?.isOrganization) throw new Error("Personal spaces don' support logos");

  try {
    return getLogo(organizationId);
  } catch (err) {
    return undefined;
  }
}

export async function organizationHasLogo(organizationId: string) {
  const organization = await getEnvironmentById(organizationId, undefined, {
    throwOnNotFound: true,
  });
  if (!organization?.isOrganization) throw new Error("Personal spaces don' support logos");

  return hasLogo(organizationId);
}

export async function deleteOrganizationLogo(organizationId: string) {
  const organization = await getEnvironmentById(organizationId, undefined, {
    throwOnNotFound: true,
  });
  if (!organization?.isOrganization) throw new Error("Personal spaces don' support logos");

  if (!hasLogo(organizationId)) throw new Error("Organization doesn't have a logo");

  deleteLogo(organizationId);
}

export async function updateOrganization(
  environmentId: string,
  environmentInput: Partial<UserOrganizationEnvironmentInput>,
  ability?: Ability,
) {
  const environment = await getEnvironmentById(environmentId, ability, { throwOnNotFound: true });

  if (!environment) {
    throw new Error('Environment not found');
  }

  if (
    ability &&
    !ability.can('update', toCaslResource('Environment', environment), { environmentId })
  )
    throw new UnauthorizedError();

  if (!environment.isOrganization) throw new Error('Environment is not an organization');

  const update = UserOrganizationEnvironmentInputSchema.partial().parse(environmentInput);
  const newEnvironmentData: Environment = { ...environment, ...update } as Environment;

  environmentsMetaObject[environmentId] = newEnvironmentData;
  store.update('environments', environmentId, newEnvironmentData);

  return newEnvironmentData;
}

let inited = false;
/**
 * initializes the environments meta information objects
 */
export function init() {
  if (!firstInit || inited) return;
  inited = true;

  const storedEnvironemnts = store.get('environments') as any[];

  // set roles store cache for quick access
  storedEnvironemnts.forEach(
    (environments) => (environmentsMetaObject[environments.id] = environments),
  );
}
init();
