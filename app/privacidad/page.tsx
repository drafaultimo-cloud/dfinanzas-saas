import type { Metadata } from 'next';
import LegalPage, { H2, P, UL } from '@/components/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: `Política de Privacidad • ${LEGAL.brand}` };

export default function Privacidad() {
  return (
    <LegalPage title="Política de Privacidad">
      <P>
        En {LEGAL.brand} sabemos que tus finanzas son información muy personal. Esta política explica qué datos guardamos, para qué los usamos, con quién los compartimos y cómo ejercer tus derechos, conforme a la Ley N° 25.326 de Protección de los Datos Personales de la República Argentina.
      </P>

      <H2>1. Quién es el responsable</H2>
      <P>
        El responsable del tratamiento de tus datos es {LEGAL.owner} (marca {LEGAL.trade}){LEGAL.cuit ? `, CUIT ${LEGAL.cuit}` : ''}, con domicilio en {LEGAL.address}. Contacto para consultas y ejercicio de derechos: <a className="text-[#00D7FF] underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </P>

      <H2>2. Qué datos recopilamos</H2>
      <UL items={[
        <>Datos de cuenta: tu correo electrónico y tu contraseña (la contraseña se guarda cifrada, nosotros no podemos verla).</>,
        <>Datos financieros que cargás vos o que se extraen de los archivos que subís: movimientos, montos, descripciones, tarjetas, billeteras, préstamos, presupuestos, metas y reglas de rubros.</>,
        <>Datos de pago: cuando abonás por transferencia, guardamos el monto, la fecha, el número de operación, el nombre de quien transfiere, el destino y una huella digital del comprobante para evitar que se use dos veces.</>,
        <>Mensajes que nos enviás por el chat de soporte.</>,
        <>Datos técnicos básicos de funcionamiento (por ejemplo, registros de errores del servidor) y el contador de usos de la inteligencia artificial de tu cuenta.</>,
      ]} />
      <P>No guardamos el archivo de los extractos, tickets ni comprobantes que subís: se analizan en el momento y solo conservamos el resultado (los movimientos y datos extraídos). No usamos cookies publicitarias ni herramientas de seguimiento de terceros; el navegador guarda únicamente lo necesario para mantener tu sesión abierta.</P>

      <H2>3. Para qué usamos tus datos</H2>
      <UL items={[
        'Brindarte el servicio: mostrar tus saldos, gastos, alertas, presupuestos y reportes.',
        'Procesar con inteligencia artificial los extractos y tickets que decidas subir, y generar los diagnósticos que pidas.',
        'Verificar tus pagos y administrar tu suscripción y tu prueba gratuita.',
        'Atender tus consultas de soporte y mantener la seguridad del servicio (evitar abusos y fraudes).',
      ]} />
      <P>No vendemos tus datos ni los usamos para publicidad. No tomamos decisiones automatizadas que produzcan efectos legales sobre vos.</P>

      <H2>4. Con quién los compartimos</H2>
      <P>Para que la app funcione usamos proveedores que procesan datos en nuestro nombre:</P>
      <UL items={[
        <><strong>Supabase</strong>: base de datos y autenticación (guarda tu cuenta y tus datos).</>,
        <><strong>Vercel</strong>: alojamiento de la aplicación.</>,
        <><strong>Google (Gemini)</strong> y, como respaldo si el primero no está disponible, <strong>Anthropic (Claude)</strong>: reciben el contenido del archivo que subís (extracto, ticket o comprobante) y, en el caso del diagnóstico, un resumen de tus movimientos, únicamente para devolvernos el resultado.</>,
        <><strong>Servicios públicos de cotización del dólar</strong>: solo se consulta la cotización, sin enviar datos tuyos.</>,
      ]} />
      <P>Estos proveedores tienen sus servidores fuera de la Argentina (principalmente en Estados Unidos). Al usar el servicio aceptás esta transferencia internacional de datos, necesaria para prestarlo. Solo compartimos tus datos con terceros fuera de estos casos si una autoridad competente lo exige por ley.</P>
      <P><strong>Importante:</strong> si subís un extracto, el archivo puede contener datos de otras personas (por ejemplo, nombres de quienes te transfirieron). Subilo solo si estás autorizado a hacerlo con tu propia información.</P>

      <H2>5. Cuánto tiempo los conservamos</H2>
      <P>
        Mientras tu cuenta esté activa. Si eliminás tu cuenta, borramos tus movimientos, tarjetas, billeteras, préstamos, presupuestos, metas, reglas, mensajes y demás datos asociados. Los registros de pagos recibidos pueden conservarse el tiempo que exijan las normas contables e impositivas, sin vincularse a tu información financiera. Las copias de seguridad de los proveedores se eliminan en sus ciclos habituales.
      </P>

      <H2>6. Tus derechos</H2>
      <P>Podés acceder a tus datos, rectificarlos, actualizarlos y suprimirlos. Dentro de la aplicación podés:</P>
      <UL items={[
        <>descargar una copia de tus datos en formato JSON, desde &quot;Mi cuenta y privacidad&quot;;</>,
        <>corregir o borrar cualquier movimiento, tarjeta u otro dato;</>,
        <>eliminar tu cuenta y todos tus datos de forma definitiva.</>,
      ]} />
      <P>
        También podés escribirnos a {LEGAL.email} y respondemos dentro de los plazos legales. El acceso a tus datos es gratuito en intervalos no inferiores a seis meses, salvo que acredites un interés legítimo.
      </P>
      <P>
        La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.
      </P>

      <H2>7. Seguridad</H2>
      <P>
        Aplicamos medidas técnicas razonables: conexión cifrada, contraseñas cifradas, reglas de acceso para que cada usuario solo vea sus propios datos, límites de uso y control de accesos de administración. Ningún sistema es infalible: si detectáramos un incidente que afecte tus datos, te lo informaremos.
      </P>

      <H2>8. Menores de edad</H2>
      <P>El servicio está destinado a personas mayores de 18 años. No recopilamos a sabiendas datos de menores.</P>

      <H2>9. Cambios en esta política</H2>
      <P>Si la modificamos de forma importante, te avisaremos dentro de la aplicación. La fecha de la última actualización figura al comienzo de esta página.</P>
    </LegalPage>
  );
}
