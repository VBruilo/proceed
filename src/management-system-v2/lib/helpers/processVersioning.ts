import 'server-only';
import {
  toBpmnObject,
  toBpmnXml,
  setDefinitionsVersionInformation,
  getDefinitionsVersionInformation,
  getUserTaskImplementationString,
  getUserTaskFileNameMapping,
  getScriptTaskFileNameMapping,
  setUserTaskData,
  setScriptTaskData,
} from '@proceed/bpmn-helper';
import { asyncForEach } from './javascriptHelpers';

// import { getUserTaskJSON, getUserTaskHTML, getScriptTaskScript } from '../data/legacy/fileHandling';

import { Process } from '../data/process-schema';
import { enableUseDB } from 'FeatureFlags';
import { TProcessModule } from '../data/module-import-types-temp';
import { toCustomUTCString } from './timeHelper';

const { diff } = require('bpmn-js-differ');

// remove later after legacy code is removed
let getProcessVersionBpmn: TProcessModule['getProcessVersionBpmn'];
let updateProcess: TProcessModule['updateProcess'];
let getProcessBpmn: TProcessModule['getProcessBpmn'];
let deleteProcessUserTask: TProcessModule['deleteProcessUserTask'];
let getProcessUserTaskHtml: TProcessModule['getProcessUserTaskHtml'];
let getProcessUserTasksHtml: TProcessModule['getProcessUserTasksHtml'];
let getProcessUserTasksJSON: TProcessModule['getProcessUserTasksJSON'];
let saveProcessUserTask: TProcessModule['saveProcessUserTask'];
let getProcessUserTaskJSON: TProcessModule['getProcessUserTaskJSON'];

let getProcessScriptTaskScript: TProcessModule['getProcessScriptTaskScript'];
let getProcessScriptTasksScript: TProcessModule['getProcessScriptTasksScript'];
let saveProcessScriptTask: TProcessModule['saveProcessScriptTask'];
let deleteProcessScriptTask: TProcessModule['deleteProcessScriptTask'];

const loadModules = async () => {
  const moduleImport = await (enableUseDB
    ? import('@/lib/data/db/process')
    : import('@/lib/data/legacy/_process'));

  ({
    getProcessVersionBpmn,
    updateProcess,
    getProcessBpmn,
    deleteProcessUserTask,
    getProcessUserTaskHtml,
    getProcessUserTasksHtml,
    getProcessUserTasksJSON,
    saveProcessUserTask,
    getProcessUserTaskJSON,
    getProcessScriptTaskScript,
    getProcessScriptTasksScript,
    saveProcessScriptTask,
    deleteProcessScriptTask,
  } = moduleImport);
};

loadModules().catch(console.error);

// TODO: This used to be a helper file in the old management system. It used
// client-side local data from the Vue store and a lot of data sent to the
// server, which resulted in a lot of unnecessary requests to the backend. This
// should be refactored to reflect the fact this runs on the server now.

export async function areVersionsEqual(bpmn: string, otherBpmn: string) {
  const bpmnObj = await toBpmnObject(bpmn);
  const otherBpmnObj = await toBpmnObject(otherBpmn);

  const {
    versionId,
    name: versionName,
    description: versionDescription,
    versionBasedOn,
    versionCreatedOn,
  } = await getDefinitionsVersionInformation(otherBpmnObj);

  if (versionId) {
    // check if the two bpmns were the same if they had the same version information
    await setDefinitionsVersionInformation(bpmnObj, {
      versionId,
      versionName,
      versionDescription,
      versionBasedOn,
      versionCreatedOn,
    });

    // compare the two bpmns
    const changes = diff(otherBpmnObj, bpmnObj);
    const hasChanges =
      Object.keys(changes._changed).length ||
      Object.keys(changes._removed).length ||
      Object.keys(changes._added).length ||
      Object.keys(changes._layoutChanged).length;

    return !hasChanges;
  }

  return false;
}

export async function convertToEditableBpmn(bpmn: string) {
  let bpmnObj = await toBpmnObject(bpmn);

  const { versionId } = await getDefinitionsVersionInformation(bpmnObj);

  bpmnObj = (await setDefinitionsVersionInformation(bpmnObj, {
    versionBasedOn: versionId,
  })) as object;

  const changedUserTaskFileNames = {} as { [key: string]: string };
  const userTaskFileNameMapping = await getUserTaskFileNameMapping(bpmnObj);

  await asyncForEach(
    Object.entries(userTaskFileNameMapping),
    async ([userTaskId, { fileName }]) => {
      if (fileName) {
        const [unversionedName] = fileName.split('-');
        changedUserTaskFileNames[fileName] = unversionedName;
        await setUserTaskData(bpmnObj, userTaskId, unversionedName);
      }
    },
  );

  const changedScriptTaskFileNames = {} as { [key: string]: string };
  const scriptTaskFileNameMapping = await getScriptTaskFileNameMapping(bpmnObj);

  await asyncForEach(
    Object.entries(scriptTaskFileNameMapping),
    async ([scriptTaskId, { fileName }]) => {
      if (fileName) {
        const [unversionedName] = fileName.split('-');
        changedScriptTaskFileNames[fileName] = unversionedName;
        await setScriptTaskData(bpmnObj, scriptTaskId, unversionedName);
      }
    },
  );

  return { bpmn: await toBpmnXml(bpmnObj), changedUserTaskFileNames, changedScriptTaskFileNames };
}

export async function getLocalVersionBpmn(process: Process, localVersion: string) {
  // early exit if there are no known versions for the process locally
  if (!Array.isArray(process.versions) || !process.versions.length) return;

  // check if the specific version exists locally and get its bpmn if it does
  if (process.versions.some(({ id }) => id === localVersion)) {
    const bpmn = getProcessVersionBpmn(process.id, localVersion);
    return bpmn;
  }
}

export async function versionUserTasks(
  processInfo: Process,
  newVersion: string,
  bpmnObj: object,
  dryRun = false,
) {
  const htmlMapping = await getUserTaskFileNameMapping(bpmnObj);
  const versionedUserTaskFilenames: string[] = [];
  const { versionBasedOn, versionCreatedOn } = await getDefinitionsVersionInformation(bpmnObj);

  for (let userTaskId in htmlMapping) {
    const { fileName, implementation } = htmlMapping[userTaskId];

    // only version user tasks that use html
    if (fileName && implementation === getUserTaskImplementationString()) {
      const userTaskHtml = await getProcessUserTaskHtml(processInfo.id, fileName);
      let versionFileName = `${fileName}-${newVersion}`;

      // get the html of the user task in the based on version (if there is one and it is locally known)
      const basedOnBPMN =
        versionBasedOn !== undefined
          ? await getLocalVersionBpmn(processInfo, versionBasedOn!)
          : undefined;

      // check if there is a preceding version and if the html of the user task actually changed from that version
      let userTaskHtmlAlreadyExisting = false;
      if (basedOnBPMN) {
        const basedOnVersionHtmlMapping = await getUserTaskFileNameMapping(basedOnBPMN);

        // check if the user task existed and if it had the same html
        const basedOnVersionFileInfo = basedOnVersionHtmlMapping[userTaskId];

        if (basedOnVersionFileInfo && basedOnVersionFileInfo.fileName) {
          const basedOnVersionUserTaskHtml = await getProcessUserTaskHtml(
            processInfo.id,
            basedOnVersionFileInfo.fileName,
          );

          if (basedOnVersionUserTaskHtml === userTaskHtml) {
            // reuse the html of the previous version
            userTaskHtmlAlreadyExisting = true;
            versionFileName = basedOnVersionFileInfo.fileName;
          }
        }
      }

      // make sure the user task is using the correct data
      await setUserTaskData(
        bpmnObj,
        userTaskId,
        versionFileName,
        getUserTaskImplementationString(),
      );

      // store the user task version if it didn't exist before
      if (!dryRun && !userTaskHtmlAlreadyExisting) {
        const userTaskData = await getProcessUserTaskJSON(processInfo.id, fileName);
        await saveProcessUserTask(
          processInfo.id,
          versionFileName,
          userTaskData!,
          userTaskHtml!,
          versionCreatedOn,
        );
      }

      // update ref for the artifacts referenced by the versioned user task
      //const refIds = await updateArtifactRefVersionedUserTask(userTaskData!, versionFileName);
      versionedUserTaskFilenames.push(versionFileName);
    }
  }

  return versionedUserTaskFilenames;
}

export async function versionScriptTasks(
  processInfo: Process,
  newVersion: string,
  bpmnObj: object,
  dryRun = false,
) {
  const scriptMapping = await getScriptTaskFileNameMapping(bpmnObj);
  const versionedScriptTaskFilenames: string[] = [];
  const { versionBasedOn, versionCreatedOn } = await getDefinitionsVersionInformation(bpmnObj);

  for (let scriptTaskId in scriptMapping) {
    const { fileName } = scriptMapping[scriptTaskId];

    // only handle script tasks that reference a file
    if (fileName) {
      const scriptTaskJS = await getProcessScriptTaskScript(processInfo.id, fileName + '.js');
      const scriptTaskTS = await getProcessScriptTaskScript(processInfo.id, fileName + '.ts');

      let versionFileName = `${fileName}-${newVersion}`;

      // get the script of the script task in the based on version (if there is one and it is locally known)
      const basedOnBPMN =
        versionBasedOn !== undefined
          ? await getLocalVersionBpmn(processInfo, versionBasedOn)
          : undefined;

      // check if there is a preceding version and if the script of the script task actually changed from that version
      let scriptTaskScriptAlreadyExisting = false;
      if (basedOnBPMN) {
        const basedOnVersionScriptMapping = await getScriptTaskFileNameMapping(basedOnBPMN);

        // check if the script task existed and if it had the same script
        const basedOnVersionFileInfo = basedOnVersionScriptMapping[scriptTaskId];

        if (basedOnVersionFileInfo && basedOnVersionFileInfo.fileName) {
          const basedOnVersionScriptTaskJS = await getProcessScriptTaskScript(
            processInfo.id,
            basedOnVersionFileInfo.fileName + '.js',
          );
          const basedOnVersionScriptTaskTS = await getProcessScriptTaskScript(
            processInfo.id,
            basedOnVersionFileInfo.fileName + '.ts',
          );

          if (
            basedOnVersionScriptTaskJS === scriptTaskJS &&
            basedOnVersionScriptTaskTS === scriptTaskTS
          ) {
            // reuse the script of the previous version
            scriptTaskScriptAlreadyExisting = true;
            versionFileName = basedOnVersionFileInfo.fileName;
          }
        }
      }

      // make sure the script task is using the correct data
      await setScriptTaskData(bpmnObj, scriptTaskId, versionFileName);

      // store the script task version if it didn't exist before
      if (!dryRun && !scriptTaskScriptAlreadyExisting) {
        await saveProcessScriptTask(
          processInfo.id,
          versionFileName + '.js',
          scriptTaskJS,
          versionCreatedOn,
        );
        await saveProcessScriptTask(
          processInfo.id,
          versionFileName + '.ts',
          scriptTaskTS,
          versionCreatedOn,
        );
      }

      // update ref for the artifacts referenced by the versioned script task
      versionedScriptTaskFilenames.push(versionFileName);
    }
  }
  return versionedScriptTaskFilenames;
}

export async function updateProcessVersionBasedOn(processInfo: Process, versionBasedOn: string) {
  if (processInfo?.bpmn) {
    const { versionId, description, name, versionCreatedOn } =
      await getDefinitionsVersionInformation(processInfo.bpmn);

    const bpmn = (await setDefinitionsVersionInformation(processInfo.bpmn, {
      versionId,
      versionDescription: description,
      versionName: name,
      versionBasedOn,
      versionCreatedOn,
    })) as string;

    await updateProcess(processInfo.id, { bpmn });
  }
}

const getUsedScriptTaskFileNames = async (bpmn: string) => {
  const userTaskFileNameMapping = await getScriptTaskFileNameMapping(bpmn);

  const fileNames = new Set<string>();

  Object.values(userTaskFileNameMapping).forEach(({ fileName }) => {
    if (fileName) {
      fileNames.add(fileName);
    }
  });

  return [...fileNames];
};

const getUsedUserTaskFileNames = async (bpmn: string) => {
  const userTaskFileNameMapping = await getUserTaskFileNameMapping(bpmn);

  const fileNames = new Set<string>();

  Object.values(userTaskFileNameMapping).forEach(({ fileName }) => {
    if (fileName) {
      fileNames.add(fileName);
    }
  });

  return [...fileNames];
};

export async function selectAsLatestVersion(processId: string, versionId: string) {
  const versionBpmn = (await getProcessVersionBpmn(processId, versionId)) as string;

  const {
    bpmn: convertedBpmn,
    changedScriptTaskFileNames,
    changedUserTaskFileNames,
  } = await convertToEditableBpmn(versionBpmn);

  const editableBpmn = (await getProcessBpmn(processId)) as string;

  const scriptFileNamesinEditableVersion = await getUsedScriptTaskFileNames(editableBpmn);

  // delete scripts stored for latest version
  await asyncForEach(scriptFileNamesinEditableVersion, async (taskFileName) => {
    await asyncForEach(['js', 'ts', 'xml'], async (type) => {
      await deleteProcessScriptTask(processId, taskFileName + '.' + type);
    });
  });

  // store ScriptTasks from this version as ScriptTasks from latest version
  await asyncForEach(Object.entries(changedScriptTaskFileNames), async ([oldName, newName]) => {
    for (const type of ['js', 'ts', 'xml']) {
      try {
        const fileContent = await getProcessScriptTaskScript(processId, oldName + '.' + type);
        await saveProcessScriptTask(processId, newName + '.' + type, fileContent);
      } catch (err) {}
    }
  });

  const userTaskFileNamesinEditableVersion = await getUsedUserTaskFileNames(editableBpmn);

  // Delete UserTasks stored for latest version
  await asyncForEach(userTaskFileNamesinEditableVersion, async (taskFileName) => {
    await deleteProcessUserTask(processId, taskFileName);
  });

  // make sure that the user task data and html is also rolled back
  const processDataMapping = await getProcessUserTasksJSON(processId, versionId);
  const processHtmlMapping = await getProcessUserTasksHtml(processId);

  // Store UserTasks from this version as UserTasks from latest version
  await asyncForEach(Object.entries(changedUserTaskFileNames), async ([oldName, newName]) => {
    await saveProcessUserTask(
      processId,
      newName,
      processDataMapping![oldName],
      processHtmlMapping![oldName],
    );
  });

  // Store bpmn from this version as latest version
  await updateProcess(processId, { bpmn: convertedBpmn });
}
