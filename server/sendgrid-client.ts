import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

// Helper function to send a task "poke" email
export async function sendTaskPokeEmail(params: {
  toEmail: string;
  toName: string;
  taskTitle: string;
  taskDeadline?: string;
  projectName: string;
  projectId: string;
  taskDescription?: string;
  pokedBy: string;
}) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  
  const msg = {
    to: params.toEmail,
    from: fromEmail,
    subject: `Action Required: ${params.taskTitle} - ${params.projectName}`,
    text: `Hi ${params.toName},

${params.pokedBy} has sent you a reminder about the following task:

Task: ${params.taskTitle}
Project: ${params.projectName}
${params.taskDeadline ? `Deadline: ${params.taskDeadline}` : ''}
${params.taskDescription ? `\nDescription: ${params.taskDescription}` : ''}

This task requires your attention. Please review and take action as soon as possible.

View project: ${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/projects/${params.projectId}

Best regards,
Due Diligence Tracker`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Action Required</h2>
        <p>Hi ${params.toName},</p>
        <p>${params.pokedBy} has sent you a reminder about the following task:</p>
        
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400e;">${params.taskTitle}</h3>
          <p style="margin: 8px 0;"><strong>Project:</strong> ${params.projectName}</p>
          ${params.taskDeadline ? `<p style="margin: 8px 0;"><strong>Deadline:</strong> ${params.taskDeadline}</p>` : ''}
          ${params.taskDescription ? `<p style="margin: 8px 0;"><strong>Description:</strong> ${params.taskDescription}</p>` : ''}
        </div>
        
        <p>This task requires your attention. Please review and take action as soon as possible.</p>
        
        <a href="${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/projects/${params.projectId}" 
           style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          View Project
        </a>
        
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          Best regards,<br/>
          Due Diligence Tracker
        </p>
      </div>
    `
  };

  await client.send(msg);
}
