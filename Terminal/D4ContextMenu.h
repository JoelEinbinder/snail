//
//  D4ContextMenu.h
//  Terminal
//
//  Created by Joel Einbinder on 8/15/22.
//

#import <Foundation/Foundation.h>
#import <Cocoa/Cocoa.h>

NS_ASSUME_NONNULL_BEGIN

@interface D4ContextMenu : NSObject {
    void (^_callback)(NSInteger);
}
-(instancetype)initWithDescriptor:(NSDictionary*) descriptor menu:(NSMenu*)menu callback:(void (^)(NSInteger))callback;
@end

NS_ASSUME_NONNULL_END
