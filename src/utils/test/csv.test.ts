import { writeCsv } from '@/utils/csv';

describe('CSV para hojas de cálculo', () => {
  it('protege fórmulas, cita comas y conserva acentos en UTF-8', () => {
    const csv = writeCsv([
      ['Nombre', 'Estudio'],
      ['Ibáñez', '=HYPERLINK("http://x","a")'],
      ['Núñez, Salazar', '+Legal'],
    ]).toString('utf8');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""http://x"",""a"")"');
    expect(csv).toContain('"Núñez, Salazar","\'+Legal"');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});
