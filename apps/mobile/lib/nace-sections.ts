import type { NaceNode } from "@civic/shared";

/**
 * NACE letter sections (A–U) for Civic filters — one level below the
 * vocabulary root (e.g. skip "Pracovné činnosti").
 */
export function naceLetterSections(tree: NaceNode[]): NaceNode[] {
  if (tree.length === 1 && tree[0].children.length > 0) {
    return tree[0].children;
  }
  return tree;
}
