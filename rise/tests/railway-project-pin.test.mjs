import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRailwayProjectBinding,
  REQUIRED_RAILWAY_TARGET,
} from "../tools/assert-railway-project.mjs";

function fixture() {
  const cwd = "/tmp/exact-rise";
  return {
    cwd,
    config: {
      projects: {
        [cwd]: {
          project: REQUIRED_RAILWAY_TARGET.projectId,
          environment: REQUIRED_RAILWAY_TARGET.environmentId,
          service: REQUIRED_RAILWAY_TARGET.serviceId,
          name: REQUIRED_RAILWAY_TARGET.projectName,
          projectPath: cwd,
        },
      },
    },
    status: {
      id: REQUIRED_RAILWAY_TARGET.projectId,
      name: REQUIRED_RAILWAY_TARGET.projectName,
      environments: { edges: [{ node: { id: REQUIRED_RAILWAY_TARGET.environmentId, name: REQUIRED_RAILWAY_TARGET.environmentName } }] },
      services: { edges: [{ node: { id: REQUIRED_RAILWAY_TARGET.serviceId, name: REQUIRED_RAILWAY_TARGET.serviceName } }] },
    },
  };
}

test("Railway deploy guard accepts only the isolated RISE target", () => {
  const data = fixture();
  assert.equal(assertRailwayProjectBinding(data).serviceId, REQUIRED_RAILWAY_TARGET.serviceId);
});

test("Railway deploy guard rejects the shared HQ project", () => {
  const data = fixture();
  data.config.projects[data.cwd].project = "29afe885-b9b1-425d-8fd8-8611cd275409";
  assert.throws(() => assertRailwayProjectBinding(data), /target guard failed/);
});

test("Railway deploy guard rejects an inherited parent-directory link", () => {
  const data = fixture();
  delete data.config.projects[data.cwd];
  data.config.projects["/tmp"] = { project: REQUIRED_RAILWAY_TARGET.projectId };
  assert.throws(() => assertRailwayProjectBinding(data), /no exact Railway link/);
});
