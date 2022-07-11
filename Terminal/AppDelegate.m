//
//  AppDelegate.m
//  Terminal
//
//  Created by Joel Einbinder on 3/23/22.
//

#import "AppDelegate.h"

@interface AppDelegate ()


@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    [self makeAndShowWindow];
}


- (void)applicationWillTerminate:(NSNotification *)aNotification {
    // Insert code here to tear down your application
}


- (BOOL)applicationSupportsSecureRestorableState:(NSApplication *)app {
    return YES;
}
-(NSWindow*)makeWindow {
    NSStoryboard *sb = [NSStoryboard storyboardWithName:@"Window" bundle:nil];
    NSWindowController* wc = [sb instantiateControllerWithIdentifier:@"my-window"];
    return [wc window];
}
-(void)makeAndShowWindow {
    NSWindow* window = [self makeWindow];
    [window setIsVisible:YES];
    [window makeKeyWindow];
    [window setTitle:@"foo"];
}
-(IBAction)newWindowButton:(id)sender {
    [self makeAndShowWindow];
}
-(IBAction)newWindowForTab:(id)sender {
    NSWindow* window = [self makeWindow];
    NSWindow* opener = sender;
    [[opener tabGroup] addWindow:window];
    [[window tabGroup] setSelectedWindow:window];
}
-(IBAction)newTab:(id)sender {
    NSWindow* opener = [[NSApplication sharedApplication] keyWindow];
    if (opener) {
        NSWindow* window = [self makeWindow];
        [[opener tabGroup] addWindow:window];
        [[window tabGroup] setSelectedWindow:window];
    } else {
        [self makeAndShowWindow];
    }
}
- (BOOL)applicationShouldHandleReopen:(NSApplication *)sender
                    hasVisibleWindows:(BOOL)flag {
    if (flag)
        return YES;
    [self makeAndShowWindow];
    return NO;
}



@end
