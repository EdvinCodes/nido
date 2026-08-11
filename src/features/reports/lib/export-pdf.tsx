import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import type { PeriodSnapshotPayload } from '../types';
import { formatMoney, money } from '@/lib/money';
import { formatSavingsRate } from '../lib/savings-rate';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 22, marginBottom: 8 },
  subtitle: { fontSize: 12, color: '#666', marginBottom: 24 },
  section: { marginBottom: 16 },
  heading: { fontSize: 14, marginBottom: 8, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barTrack: { height: 8, backgroundColor: '#eee', marginBottom: 6 },
  barFill: { height: 8, backgroundColor: '#5B8A7A' },
});

function minorMajor(minor: number, currency: string): string {
  return formatMoney(money(BigInt(minor), currency), { showCurrency: true });
}

function ReportDocument({ payload }: { payload: PeriodSnapshotPayload }) {
  const topExpense = payload.categories.expense.slice(0, 8);
  const maxTotal = Math.max(...topExpense.map((c) => c.total_minor), 1);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{payload.space_name}</Text>
        <Text style={styles.subtitle}>
          {payload.from} – {payload.to} · {payload.base_currency}
        </Text>
        <View style={styles.section}>
          <Text style={styles.heading}>Summary</Text>
          <View style={styles.row}>
            <Text>Income</Text>
            <Text>{minorMajor(payload.totals.income_minor, payload.base_currency)}</Text>
          </View>
          <View style={styles.row}>
            <Text>Expenses</Text>
            <Text>{minorMajor(payload.totals.expense_minor, payload.base_currency)}</Text>
          </View>
          <View style={styles.row}>
            <Text>Net</Text>
            <Text>{minorMajor(payload.totals.net_minor, payload.base_currency)}</Text>
          </View>
          <View style={styles.row}>
            <Text>Savings rate</Text>
            <Text>{formatSavingsRate(payload.totals.savings_rate)}</Text>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Expenses by category</Text>
          {topExpense.map((cat) => (
            <View key={cat.id ?? cat.name} style={{ marginBottom: 8 }}>
              <View style={styles.row}>
                <Text>{cat.name}</Text>
                <Text>{minorMajor(cat.total_minor, payload.base_currency)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.round((cat.total_minor / maxTotal) * 100)}%` },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function buildReportPdf(payload: PeriodSnapshotPayload): Promise<Uint8Array> {
  const instance = pdf(<ReportDocument payload={payload} />);
  const blob = await instance.toBlob();
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}
