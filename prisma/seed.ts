import { DoseStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// IDs fijos para poder usarlos en Swagger / Postman y para que el seed sea idempotente
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
const SECOND_USER_ID = '00000000-0000-4000-8000-000000000002';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

async function main() {
  const users = [
    { id: DEMO_USER_ID, email: 'demo@scan-and-confirm.test', name: 'Usuario Demo' },
    { id: SECOND_USER_ID, email: 'cuidador@scan-and-confirm.test', name: 'Usuario Cuidador' },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { email: user.email, name: user.name },
      create: user,
    });
  }

  // Historial de ejemplo: todo con más de 1 minuto de antigüedad, para no
  // interferir con la regla de doble escaneo (409) al probar el endpoint.
  const doses = [
    { id: '10000000-0000-4000-8000-000000000001', userId: DEMO_USER_ID, medicationName: 'Ibuprofeno', nfcTagId: 'nfc-tag-001', status: DoseStatus.TAKEN, timestamp: hoursAgo(26) },
    { id: '10000000-0000-4000-8000-000000000002', userId: DEMO_USER_ID, medicationName: 'Ibuprofeno', nfcTagId: 'nfc-tag-001', status: DoseStatus.TAKEN, timestamp: hoursAgo(2) },
    { id: '10000000-0000-4000-8000-000000000003', userId: DEMO_USER_ID, medicationName: 'Creatina', nfcTagId: 'nfc-tag-002', status: DoseStatus.TAKEN, timestamp: hoursAgo(5) },
    { id: '10000000-0000-4000-8000-000000000004', userId: DEMO_USER_ID, medicationName: 'Vitamina D', nfcTagId: 'nfc-tag-003', status: DoseStatus.MANUAL, timestamp: hoursAgo(30) },
    { id: '10000000-0000-4000-8000-000000000005', userId: SECOND_USER_ID, medicationName: 'Metformina', nfcTagId: 'nfc-tag-004', status: DoseStatus.TAKEN, timestamp: hoursAgo(3) },
  ];

  for (const dose of doses) {
    await prisma.doseLog.upsert({
      where: { id: dose.id },
      update: {},
      create: dose,
    });
  }

  console.log(`Seed listo: ${users.length} usuarios y ${doses.length} dosis de ejemplo.`);
  console.log(`userId de prueba: ${DEMO_USER_ID}`);
}

main()
  .catch((error) => {
    console.error('Error ejecutando el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
