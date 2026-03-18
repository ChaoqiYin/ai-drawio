"use client";

import type { CliInstallStatus } from "./tauri-cli-install";

export function getCliInstallStatusLabel(status: CliInstallStatus["status"]): string {
  switch (status) {
    case "installed":
      return "已安装";
    case "installed_other_build":
      return "已安装到其他构建";
    case "mismatched":
      return "安装目标异常";
    case "error":
      return "状态异常";
    case "not_installed":
    default:
      return "未安装";
  }
}

export function getCliInstallStatusColor(status: CliInstallStatus["status"]): "green" | "orange" | "red" | "gray" {
  switch (status) {
    case "installed":
      return "green";
    case "installed_other_build":
    case "mismatched":
      return "orange";
    case "error":
      return "red";
    case "not_installed":
    default:
      return "gray";
  }
}
