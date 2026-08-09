import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ReceiptDetail } from "@civic/shared";
import { colors } from "@/constants/theme";
import { fetchReceiptDetail } from "@/lib/api";
import { t } from "@/lib/i18n";

type Props = {
  receiptUid: string | null;
  onClose: () => void;
};

export function ReceiptDetailModal({ receiptUid, onClose }: Props) {
  const visible = receiptUid != null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);

  useEffect(() => {
    if (!receiptUid) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    void fetchReceiptDetail(receiptUid)
      .then((res) => {
        if (cancelled) return;
        if (!res.found) {
          const map: Record<string, string> = {
            invalid_uid: t("receipts.error_invalid"),
            not_found: t("receipts.error_not_found"),
            fs_error: t("receipts.error_fs"),
          };
          setError(map[res.code] ?? res.message);
          return;
        }
        setDetail(res);
      })
      .catch(() => {
        if (!cancelled) setError(t("receipts.error_api"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [receiptUid]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.shell}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("receipts.detail_title")}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={styles.close}>{t("common.close")}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.loadingText}>{t("receipts.detail_loading")}</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : detail ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator
          >
            <Section title={t("receipts.detail_when")}>
              <InfoRow
                label={t("receipts.detail_date")}
                value={
                  detail.purchase_at_display ??
                  formatIsoDate(detail.purchase_at) ??
                  "—"
                }
              />
              <InfoRow
                label={t("receipts.detail_receipt_no")}
                value={
                  detail.receipt_number != null
                    ? String(detail.receipt_number)
                    : "—"
                }
              />
              <InfoRow
                label={t("receipts.detail_uid")}
                value={detail.receipt_uid}
                mono
              />
            </Section>

            <Section title={t("receipts.detail_where")}>
              <InfoRow
                label={t("receipts.merchant")}
                value={detail.merchant_name ?? "—"}
              />
              {detail.merchant_address ? (
                <InfoRow
                  label={t("receipts.detail_merchant_address")}
                  value={detail.merchant_address}
                />
              ) : null}
              {detail.store_name || detail.store_address ? (
                <InfoRow
                  label={t("receipts.detail_store")}
                  value={
                    [detail.store_name, detail.store_address]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  }
                />
              ) : null}
              {detail.ico ? (
                <InfoRow label={t("receipts.detail_ico")} value={detail.ico} />
              ) : null}
              {detail.ic_dph ? (
                <InfoRow
                  label={t("receipts.detail_ic_dph")}
                  value={detail.ic_dph}
                />
              ) : null}
            </Section>

            <Section title={t("receipts.detail_totals")}>
              <InfoRow
                label={t("receipts.detail_total")}
                value={
                  detail.total_price_eur != null
                    ? `${detail.total_price_eur.toFixed(2)} ${t("common.eur")}`
                    : "—"
                }
              />
              <InfoRow
                label={t("receipts.vat")}
                value={`${detail.vat_eur.toFixed(2)} ${t("common.eur")}`}
              />
            </Section>

            <Section title={t("receipts.detail_vat_title")}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colRate]}>
                  {t("receipts.detail_vat_rate")}
                </Text>
                <Text style={[styles.th, styles.colMoney]}>
                  {t("receipts.detail_vat_base")}
                </Text>
                <Text style={[styles.th, styles.colMoney]}>
                  {t("receipts.detail_vat_amount")}
                </Text>
              </View>
              {detail.vat_summary.length === 0 ? (
                <FallbackVatRows detail={detail} />
              ) : (
                detail.vat_summary.map((row) => (
                  <View
                    key={`vat-${row.vat_rate}-${row.vat_base_eur}`}
                    style={styles.tableRow}
                  >
                    <Text style={[styles.td, styles.colRate]}>
                      {row.vat_rate} %
                    </Text>
                    <Text style={[styles.td, styles.colMoney]}>
                      {row.vat_base_eur.toFixed(2)}
                    </Text>
                    <Text style={[styles.td, styles.colMoney]}>
                      {row.vat_amount_eur.toFixed(2)}
                    </Text>
                  </View>
                ))
              )}
              {detail.free_tax_eur > 0 ? (
                <InfoRow
                  label={t("receipts.detail_free_tax")}
                  value={`${detail.free_tax_eur.toFixed(2)} ${t("common.eur")}`}
                />
              ) : null}
            </Section>

            <Section title={t("receipts.detail_items_title")}>
              {detail.items.length === 0 ? (
                <Text style={styles.hint}>{t("receipts.detail_items_empty")}</Text>
              ) : (
                detail.items.map((item, idx) => (
                  <View
                    key={`${item.name}-${idx}`}
                    style={styles.itemCard}
                  >
                    <Text style={styles.itemName}>{item.name || "—"}</Text>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemMetaText}>
                        {item.quantity} × · {item.vat_rate} % DPH
                        {item.item_type ? ` · ${item.item_type}` : ""}
                      </Text>
                      <Text style={styles.itemPrice}>
                        {item.price_eur.toFixed(2)} {t("common.eur")}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Section>

            <Text style={styles.footnote}>{t("receipts.detail_source")}</Text>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

function FallbackVatRows({ detail }: { detail: ReceiptDetail }) {
  const rows: Array<{ rate: number | null; base: number; amount: number }> = [];
  if (detail.vat_amount_basic_eur > 0 || detail.tax_base_basic_eur > 0) {
    rows.push({
      rate: detail.vat_rate_basic,
      base: detail.tax_base_basic_eur,
      amount: detail.vat_amount_basic_eur,
    });
  }
  if (detail.vat_amount_reduced_eur > 0 || detail.tax_base_reduced_eur > 0) {
    rows.push({
      rate: detail.vat_rate_reduced,
      base: detail.tax_base_reduced_eur,
      amount: detail.vat_amount_reduced_eur,
    });
  }
  if (rows.length === 0) {
    return <Text style={styles.hint}>{t("receipts.detail_vat_empty")}</Text>;
  }
  return (
    <>
      {rows.map((row, i) => (
        <View key={`fb-${i}`} style={styles.tableRow}>
          <Text style={[styles.td, styles.colRate]}>
            {row.rate != null ? `${row.rate} %` : "—"}
          </Text>
          <Text style={[styles.td, styles.colMoney]}>
            {row.base.toFixed(2)}
          </Text>
          <Text style={[styles.td, styles.colMoney]}>
            {row.amount.toFixed(2)}
          </Text>
        </View>
      ))}
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

function formatIsoDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("sk-SK");
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  close: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.brandSoft,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  loadingText: { color: colors.muted },
  error: { color: colors.danger, fontWeight: "600", textAlign: "center" },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 4,
  },
  infoRow: {
    gap: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: "500",
  },
  mono: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  tableHeader: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tableRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 6,
  },
  th: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
  },
  td: {
    fontSize: 13,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  colRate: { width: 56 },
  colMoney: { flex: 1, textAlign: "right" },
  itemCard: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  itemMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  itemMetaText: {
    fontSize: 12,
    color: colors.muted,
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  hint: { fontSize: 13, color: colors.muted },
  footnote: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginTop: 4,
  },
});
