import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { crmNotes, users } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createTimelineEvent } from '../services/timeline-event-service';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const entityType = req.query.entityType as string;
    const entityId = req.query.entityId as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required' });
    }
    
    const notes = await db
      .select({
        note: crmNotes,
        author: {
          id: users.id,
          name: users.displayName,
          email: users.email,
        }
      })
      .from(crmNotes)
      .leftJoin(users, eq(crmNotes.createdById, users.id))
      .where(and(
        eq(crmNotes.orgId, orgId),
        eq(crmNotes.entityType, entityType),
        eq(crmNotes.entityId, entityId)
      ))
      .orderBy(desc(crmNotes.createdAt))
      .limit(limit)
      .offset(offset);
    
    res.json({
      items: notes.map(row => ({
        ...row.note,
        author: row.author
      })),
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.post('/', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    
    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const schema = z.object({
      content: z.string().min(1),
      isPinned: z.boolean().optional().default(false),
      entityType: z.string(),
      entityId: z.string(),
    });
    
    const data = schema.parse(req.body);
    
    const [note] = await db.insert(crmNotes).values({
      content: data.content,
      isPinned: data.isPinned,
      entityType: data.entityType,
      entityId: data.entityId,
      orgId: orgId,
      createdById: userId,
      ownerId: userId,
    }).returning();
    
    await createTimelineEvent({
      orgId,
      actorId: userId,
      entityType: data.entityType,
      entityId: data.entityId,
      eventType: 'note_created',
      title: 'Note added',
      description: data.content.substring(0, 200),
      metadata: { noteId: note.id, isPinned: data.isPinned },
    });
    
    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create note' });
    }
  }
});

router.patch('/:id/pin', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    const { isPinned } = req.body;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const [note] = await db
      .update(crmNotes)
      .set({ isPinned, updatedAt: new Date() })
      .where(and(
        eq(crmNotes.id, id),
        eq(crmNotes.orgId, orgId)
      ))
      .returning();
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    res.json(note);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    const { id } = req.params;
    
    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const schema = z.object({
      content: z.string().min(1).optional(),
      isPinned: z.boolean().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const updateData: any = { updatedAt: new Date() };
    if (data.content !== undefined) updateData.content = data.content;
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
    
    const [note] = await db
      .update(crmNotes)
      .set(updateData)
      .where(and(
        eq(crmNotes.id, id),
        eq(crmNotes.orgId, orgId)
      ))
      .returning();
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    if (data.content) {
      await createTimelineEvent({
        orgId,
        actorId: userId,
        entityType: note.entityType,
        entityId: note.entityId,
        eventType: 'note_updated',
        title: 'Note updated',
        description: data.content.substring(0, 200),
        metadata: { noteId: note.id },
      });
    }
    
    res.json(note);
  } catch (error) {
    console.error('Error updating note:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update note' });
    }
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const [deleted] = await db
      .delete(crmNotes)
      .where(and(
        eq(crmNotes.id, id),
        eq(crmNotes.orgId, orgId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
