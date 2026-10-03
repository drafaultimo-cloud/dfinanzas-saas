import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage, { H2, P, UL } from '@/components/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: `Términos y Condiciones • ${LEGAL.brand}` };

export default function Terminos() {
  return (
    <LegalPage title="Términos y Condiciones de Uso">
      <P>
        Estos términos regulan el uso de {LEGAL.brand} (el &quot;Servicio&quot;), ofrecido por {LEGAL.owner} bajo la marca {LEGAL.trade}{LEGAL.cuit ? `, CUIT ${LEGAL.cuit}` : ''}, con domicilio en {LEGAL.address}. Al crear una cuenta o usar el Servicio declarás que los leíste y que los aceptás, junto con la <Link href="/privacidad" className="text-[#00D7FF] underline">Política de Privacidad</Link>.
      </P>

      <H2>1. Qué es el Servicio</H2>
      <P>
        Es una aplicación web para organizar tus finanzas personales o de tu comercio: registrar gastos e ingresos, seguir tarjetas, billeteras y préstamos, definir presupuestos y metas, recibir alertas en pantalla e importar extractos con ayuda de inteligencia artificial.
      </P>

      <H2>2. No es asesoramiento financiero</H2>
      <P>
        El Servicio es una herramienta de organización e información. Los cálculos, alertas, diagnósticos y sugerencias no constituyen asesoramiento financiero, contable, impositivo ni legal, ni una recomendación de inversión o de endeudamiento. Las decisiones que tomes son tu responsabilidad; ante dudas importantes consultá con un profesional.
      </P>

      <H2>3. Inteligencia artificial y exactitud de los datos</H2>
      <P>
        La lectura de extractos, tickets y comprobantes y los diagnósticos se hacen con inteligencia artificial, que puede equivocarse (montos, fechas, rubros, duplicados, tipo de operación). Por eso la app te muestra una vista previa que podés corregir antes de guardar. Es tu responsabilidad revisar la información y compararla con tus extractos y resúmenes oficiales, que son siempre la fuente válida. Los saldos y deudas que muestra la app son referenciales y no reemplazan el saldo informado por tu banco o emisor de tarjeta.
      </P>

      <H2>4. Tu cuenta</H2>
      <UL items={[
        'Tenés que ser mayor de 18 años y darnos un correo electrónico válido.',
        'Sos responsable de mantener la confidencialidad de tu contraseña y de lo que ocurra en tu cuenta. Avisanos si sospechás un uso no autorizado.',
        'Cada cuenta es personal. No podés cederla ni usarla para eludir los límites del Servicio (por ejemplo, creando cuentas nuevas para repetir la prueba gratuita).',
      ]} />

      <H2>5. Prueba gratuita, planes y pagos</H2>
      <UL items={[
        'Al registrarte tenés una prueba gratuita de 10 días con acceso completo.',
        'Después, para seguir usando el Servicio necesitás un plan pago. Los planes, funciones y precios vigentes se muestran dentro de la aplicación antes de pagar; los precios incluyen los descuentos promocionales indicados mientras estén vigentes.',
        'Cada pago acredita 30 días de acceso desde la fecha del comprobante, y los días se acumulan si pagás antes del vencimiento. No hay renovación automática: si no volvés a pagar, el acceso se suspende al terminar el período.',
        'El pago se realiza por transferencia a la cuenta indicada en la aplicación y se acredita subiendo el comprobante. Los comprobantes se verifican con controles automáticos y, cuando hace falta, de forma manual; si algo no coincide (monto, destinatario, fecha o número de operación) puede rechazarse.',
        'El uso de las funciones con inteligencia artificial tiene un tope mensual por cuenta, que se informa en la aplicación y puede ajustarse para evitar abusos.',
        'Podemos modificar precios y planes hacia adelante; los cambios no afectan a los períodos ya pagados.',
      ]} />

      <H2>6. Derecho de arrepentimiento y reembolsos</H2>
      <P>
        Si contratás el Servicio a distancia, tenés derecho a revocar la aceptación dentro de los 10 días corridos desde que se acredita tu pago (Ley N° 24.240 de Defensa del Consumidor y Resolución 424/2020 de la Secretaría de Comercio Interior). Para ejercerlo escribinos a {LEGAL.email} indicando tu correo de registro y te devolvemos el importe abonado por el mismo medio, sin costo para vos. Esto es sin perjuicio de otros derechos que la ley te reconozca.
      </P>

      <H2>7. Uso aceptable</H2>
      <P>Te comprometés a no:</P>
      <UL items={[
        'usar el Servicio para fines ilegales o para procesar información de terceros sin autorización;',
        'intentar acceder a datos de otros usuarios, vulnerar la seguridad, hacer ingeniería inversa o automatizar el acceso para sobrecargar el sistema;',
        'subir comprobantes de pago falsos, alterados o ajenos;',
        'revender el Servicio o permitir su uso a terceros por fuera de las funciones de acceso compartido que la propia aplicación ofrece.',
      ]} />
      <P>Si se incumple esto podemos suspender o dar de baja la cuenta.</P>

      <H2>8. Disponibilidad y responsabilidad</H2>
      <P>
        Hacemos lo posible por mantener el Servicio disponible y tus datos protegidos, pero se brinda &quot;tal cual está&quot;: puede haber interrupciones, errores o cambios, incluso por fallas de proveedores externos (alojamiento, base de datos, inteligencia artificial). Te recomendamos descargar una copia de tus datos periódicamente. En la máxima medida permitida por la ley, no respondemos por pérdidas indirectas ni por decisiones financieras tomadas en base a la información mostrada, y nuestra responsabilidad total se limita al importe que hayas pagado en los últimos 3 meses. Esto no limita los derechos que la ley otorga a los consumidores.
      </P>

      <H2>9. Tus datos y baja de la cuenta</H2>
      <P>
        Tus datos son tuyos. Podés descargarlos y eliminar tu cuenta cuando quieras desde &quot;Mi cuenta y privacidad&quot;. La eliminación es definitiva y no se puede deshacer. El tratamiento de tus datos personales se detalla en la <Link href="/privacidad" className="text-[#00D7FF] underline">Política de Privacidad</Link>.
      </P>

      <H2>10. Propiedad intelectual</H2>
      <P>
        La aplicación, su diseño, marca y código pertenecen a {LEGAL.owner} / {LEGAL.trade}. Te otorgamos una licencia personal, limitada y revocable para usarla mientras tu cuenta esté activa. Los datos que cargás siguen siendo tuyos y nos autorizás solo a tratarlos para prestarte el Servicio.
      </P>

      <H2>11. Cambios en los términos</H2>
      <P>
        Podemos actualizar estos términos. Si el cambio es importante te avisaremos dentro de la aplicación y, si seguís usando el Servicio después del aviso, se entiende que lo aceptás. Si no estás de acuerdo, podés dar de baja tu cuenta.
      </P>

      <H2>12. Ley aplicable y contacto</H2>
      <P>
        Estos términos se rigen por las leyes de la República Argentina. Para cualquier controversia serán competentes los tribunales ordinarios de Río Gallegos, Santa Cruz, sin perjuicio del derecho del consumidor a demandar ante los tribunales de su domicilio. Consultas, reclamos o ejercicio de derechos: <a className="text-[#00D7FF] underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </P>
      <P>Los consumidores pueden presentar reclamos ante la Dirección de Defensa del Consumidor de su jurisdicción.</P>
    </LegalPage>
  );
}
