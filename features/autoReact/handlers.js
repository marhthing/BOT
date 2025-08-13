/**
 * Auto-React Feature Event Handlers
 */

module.exports = {
    'messages.upsert': async (messageUpdate, feature) => {
        try {
            await feature.handleMessage(messageUpdate);
        } catch (error) {
            feature.logger?.error('❌ Error in messages.upsert handler:', error);
        }
    },

    'connection.update': async (update, feature) => {
        try {
            const { connection } = update;
            
            if (connection === 'open') {
                feature.logger?.info('🔗 Connection established, auto-react active');
            } else if (connection === 'close') {
                feature.logger?.info('🔌 Connection closed, saving auto-react data');
                await feature.saveReactionData();
            }
            
        } catch (error) {
            feature.logger?.error('❌ Error in connection.update handler:', error);
        }
    },

    'reaction.sent': async (data, feature) => {
        try {
            // Handle reaction sent events
            const { messageId, reaction, chatId } = data;
            
            feature.logger?.debug('😍 Reaction sent:', {
                messageId: messageId,
                reaction: reaction,
                chatId: chatId
            });
            
        } catch (error) {
            feature.logger?.error('❌ Error in reaction.sent handler:', error);
        }
    },

    'settings.updated': async (data, feature) => {
        try {
            // Handle settings updates
            const { setting, value } = data;
            
            if (setting.startsWith('autoReact.')) {
                feature.logger?.info(`⚙️ Auto-react setting updated: ${setting} = ${value}`);
                
                // Reload settings
                await feature.loadConfig();
            }
            
        } catch (error) {
            feature.logger?.error('❌ Error in settings.updated handler:', error);
        }
    }
};
