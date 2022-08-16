//
//  D4ContextMenu.m
//  Terminal
//
//  Created by Joel Einbinder on 8/15/22.
//

#import "D4ContextMenu.h"
#import <Cocoa/Cocoa.h>

@implementation D4ContextMenu

-(instancetype)initWithDescriptor:(NSDictionary*) descriptor menu:(NSMenu*)menu callback:(void (^)(NSInteger))callback {
    self = [super init];
    _callback = callback;
    NSArray<NSDictionary*>* menuItems = descriptor[@"menuItems"];
    for (NSDictionary* dict in menuItems)
        [menu addItem:[self buildItem:dict]];

    return self;
}
-(NSMenuItem*)buildItem: (NSDictionary*) descriptor {
    NSMenuItem* item = descriptor[@"title"] ? [[NSMenuItem alloc] initWithTitle:descriptor[@"title"] action:nil keyEquivalent:@""] : [NSMenuItem separatorItem];
    if (descriptor[@"callback"]) {
        [item setAction:@selector(menuItemPressed:)];
        [item setTarget:self];
        [item setTag:[descriptor[@"callback"] integerValue]];
    }
    NSArray<NSDictionary*>* submenuDescriptor = descriptor[@"submenu"];
    if (submenuDescriptor) {
        NSMenu* submenu = [[NSMenu alloc] initWithTitle:descriptor[@"title"]];
        for (NSDictionary* dict in submenuDescriptor)
            [submenu addItem:[self buildItem:dict]];
        [item setSubmenu:submenu];
    }
    return item;
}

-(void)menuItemPressed:(NSMenuItem*) item {
    _callback([item tag]);
    _callback = NULL;
}
@end
