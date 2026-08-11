import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { render } from '@react-email/render';

export type NotificationEmailProps = {
  title: string;
  body: string;
  actionUrl: string;
  unsubscribeUrl: string;
  recipientName?: string;
};

export function NotificationEmail({
  title,
  body,
  actionUrl,
  unsubscribeUrl,
  recipientName,
}: NotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>{title}</Heading>
          {recipientName ? <Text style={text}>Hi {recipientName},</Text> : null}
          <Text style={text}>{body}</Text>
          <Section style={btnSection}>
            <Button style={button} href={actionUrl}>
              Open in Nido
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            <Link href={unsubscribeUrl} style={link}>
              Unsubscribe from this notification kind
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderNotificationEmail(props: NotificationEmailProps): Promise<{
  html: string;
  text: string;
}> {
  const html = await render(<NotificationEmail {...props} />);
  const text = `${props.title}\n\n${props.body}\n\nOpen: ${props.actionUrl}\n\nUnsubscribe: ${props.unsubscribeUrl}`;
  return { html, text };
}

const main = {
  backgroundColor: '#1c1a18',
  fontFamily: 'system-ui, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '24px',
  maxWidth: '560px',
};

const heading = {
  color: '#e6a848',
  fontSize: '22px',
  fontWeight: '600' as const,
};

const text = {
  color: '#f5f3ef',
  fontSize: '15px',
  lineHeight: '1.5',
};

const btnSection = {
  marginTop: '24px',
};

const button = {
  backgroundColor: '#e6a848',
  color: '#1c1a18',
  padding: '12px 20px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: '600' as const,
};

const hr = {
  borderColor: '#3d3935',
  margin: '24px 0',
};

const footer = {
  color: '#9a9590',
  fontSize: '12px',
};

const link = {
  color: '#9a9590',
};
