//
//  ViewController.h
//  Terminal
//
//  Created by Joel Einbinder on 3/23/22.
//

#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import "NodeTalker.h"
#import "D4WebPanel.h"
#import "BrowserView.h"

@interface _WKInspector
-(void)showConsole;
@end
//@protocol WKInspectorFrontendChannel
//-(void)sendMessageToBackend:(NSString*)message;
//-(void)close;
//@property (nonatomic, copy, nullable) void (^onMessage)(NSString*);
//@end
@interface D4WebView : WKWebView
//-(id)_inspector;
//-(id)connectInspectorFrontendChannel;
@end

@interface ViewController : NSViewController<WKUIDelegate, WKScriptMessageHandler, NSWindowDelegate> {
    D4WebView* webView;
    NodeTalker* nodeTalker;
    D4WebPanel* panel;
    NSView* containerView;
    NSMutableDictionary<NSString*, BrowserView*>* browserViews;
    id <WKInspectorFrontendChannel> inspectorChannel;
}
-(IBAction)reloadWindow:(id)sender;
@end

