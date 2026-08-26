#!/usr/bin/python3

import os
import re
import sys


NODE_BINARY = "/usr/local/bin/node"
SERVICE_WRAPPER = (
    "/Users/brianb/MissionMed_worktrees/F2-LOR-1009/missionmed-hq/"
    "scripts/lor-studio/run-dr133-railway-production-service-operation.mjs"
)
MODES = {
    "connectivity-preflight",
    "migration",
    "successor-migration",
    "schema-verifier",
    "rollback-drill",
    "runtime-login",
    "runtime-login-deprovision",
}
UUID = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-"
    r"[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)
PORT = re.compile(r"^[1-9][0-9]{3,4}$")


def required(source, key, minimum=1, maximum=4096):
    value = source.get(key)
    if (
        not isinstance(value, str)
        or len(value) < minimum
        or len(value) > maximum
        or any(ord(character) < 32 or ord(character) == 127 for character in value)
    ):
        raise ValueError("invalid environment")
    return value


def required_ca(source):
    value = source.get("LOR_DR133_RUNTIME_DATABASE_CA")
    if (
        not isinstance(value, str)
        or len(value) < 256
        or len(value) > 16384
        or "\x00" in value
        or not value.startswith("-----BEGIN CERTIFICATE-----\n")
        or not value.rstrip("\n").endswith("-----END CERTIFICATE-----")
        or "PRIVATE KEY" in value
    ):
        raise ValueError("invalid certificate")
    return value


def sanitized_environment(source, expected_mode, expected_port):
    database_url = required(source, "DATABASE_URL", 64)
    database_ca = required_ca(source)
    mode = required(source, "LOR_DR133_MODE", 3, 64)
    tunnel_host = required(source, "LOR_DR133_TUNNEL_HOST", 9, 9)
    tunnel_port = required(source, "LOR_DR133_TUNNEL_PORT", 4, 5)
    deployment_id = required(source, "RAILWAY_DEPLOYMENT_ID", 36, 36)
    environment_id = required(source, "RAILWAY_ENVIRONMENT_ID", 36, 36)
    environment_name = required(source, "RAILWAY_ENVIRONMENT_NAME", 10, 10)
    project_id = required(source, "RAILWAY_PROJECT_ID", 36, 36)
    region = required(source, "RAILWAY_REPLICA_REGION", 3, 32)
    service_id = required(source, "RAILWAY_SERVICE_ID", 36, 36)
    if (
        mode not in MODES
        or mode != expected_mode
        or tunnel_host != "127.0.0.1"
        or tunnel_port != expected_port
        or PORT.fullmatch(tunnel_port) is None
        or not 1024 <= int(tunnel_port) <= 65535
        or environment_name != "production"
        or any(
            UUID.fullmatch(value) is None
            for value in (deployment_id, environment_id, project_id, service_id)
        )
    ):
        raise ValueError("invalid target")
    clean = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "LANG": "C",
        "LC_ALL": "C",
        "TZ": "UTC",
        "TERM": "dumb",
        "NO_COLOR": "1",
        "CI": "1",
        "DATABASE_URL": database_url,
        "LOR_DR133_MODE": mode,
        "LOR_DR133_RUNTIME_DATABASE_CA": database_ca,
        "LOR_DR133_TUNNEL_HOST": tunnel_host,
        "LOR_DR133_TUNNEL_PORT": tunnel_port,
        "RAILWAY_DEPLOYMENT_ID": deployment_id,
        "RAILWAY_ENVIRONMENT_ID": environment_id,
        "RAILWAY_ENVIRONMENT_NAME": environment_name,
        "RAILWAY_PROJECT_ID": project_id,
        "RAILWAY_REPLICA_REGION": region,
        "RAILWAY_SERVICE_ID": service_id,
    }
    if mode == "runtime-login":
        clean["LOR_DR133_RUNTIME_DATABASE_URL"] = required(
            source, "LOR_DR133_RUNTIME_DATABASE_URL", 64
        )
    return clean


def main():
    if (
        len(sys.argv) != 5
        or sys.argv[1] != NODE_BINARY
        or sys.argv[2] != SERVICE_WRAPPER
        or sys.argv[3] not in MODES
        or PORT.fullmatch(sys.argv[4]) is None
    ):
        return 1
    clean = sanitized_environment(os.environ, sys.argv[3], sys.argv[4])
    os.environ.clear()
    os.execve(NODE_BINARY, [NODE_BINARY, SERVICE_WRAPPER], clean)
    return 1


if __name__ == "__main__":
    try:
        status = main()
    except BaseException:
        status = 1
    os._exit(status)
