/**
 * Anti-Delete Feature Event Handlers
 */

module.exports = {
    'messages.upsert': async (messageUpdate, feature) => {
        try {
            await feature.handleMessage(messageUpdate);
        } catch (error) {
            feature.logger?.error('❌ Error in messages.upsert handler:', error);
        }
    },

    'messages.delete': async (deleteInfo, feature) => {
        try {
            await feature.handleMessageDelete(deleteInfo);
        } catch (error) {
            feature.logger?.error('❌ Error in messages.delete handler:', error);
        }
    },

    'messages.update': async (messageUpdate, feature) => {
        try {
            // Handle message updates (could include edit tracking)
            if (!feature.isFeatureEnabled()) return;
            
            const { messages, type } = messageUpdate;
            
            for (const message of messages) {
                if (message.key.fromMe) continue;
                
                // Log message updates for potential edit tracking
                feature.logger?.debug('📝 Message update detected:', {
                    messageId: message.key.id,
                    chatId: message.key.remoteJid,
                    type: type
                });
            }
            
        } catch (error) {
            feature.logger?.error('❌ Error in messages.update handler:', error);
        }
    },

    'connection.update': async (update, feature) => {
        try {
            const { connection } = update;
            
            if (connection === 'open') {
                feature.logger?.info('🔗 Connection established, anti-delete monitoring active');
            } else if (connection === 'close') {
                feature.logger?.info('🔌 Connection closed, saving anti-delete data');
                await feature.saveDeleteData();
            }
            
        } catch (error) {
            feature.logger?.error('❌ Error in connection.update handler:', error);
        }
    },

    'message.send': async (data, feature) => {
        try {
            // Handle outgoing message requests from anti-delete
            const { to, message } = data;
            
            // This would be handled by the message utils or bot manager
            feature.logger?.debug('📤 Sending delete notification:', {
                to: to,
                messageLength: message.length
            });
            
        } catch (error) {
            feature.logger?.error('❌ Error in message.send handler:', error);
        }
    }
};
