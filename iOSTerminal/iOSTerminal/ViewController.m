//
//  ViewController.m
//  iOSTerminal
//
//  Created by Joel Einbinder on 9/3/22.
//

#import "ViewController.h"
#import <LibSSH/libssh.h>
NSString* show_remote_processes(ssh_session session)
{
  ssh_channel channel;
  int rc;
  char buffer[256];
  int nbytes;
 
  channel = ssh_channel_new(session);
  if (channel == NULL)
    return nil;
 
  rc = ssh_channel_open_session(channel);
  if (rc != SSH_OK)
  {
    ssh_channel_free(channel);
    return nil;
  }
 
  rc = ssh_channel_request_exec(channel, "ps aux");
  if (rc != SSH_OK)
  {
    ssh_channel_close(channel);
    ssh_channel_free(channel);
    return nil;
  }
 
  nbytes = ssh_channel_read(channel, buffer, sizeof(buffer), 0);
    NSMutableData* data = [[NSMutableData alloc] init];
  while (nbytes > 0)
  {
      [data appendBytes:buffer length:nbytes];
    nbytes = ssh_channel_read(channel, buffer, sizeof(buffer), 0);
  }
    NSString* str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  if (nbytes < 0)
  {
    ssh_channel_close(channel);
    ssh_channel_free(channel);
    return nil;
  }
 
  ssh_channel_send_eof(channel);
  ssh_channel_close(channel);
  ssh_channel_free(channel);
 
  return str;
}

@interface ViewController ()

@end
@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    UITextView* text = [[UITextView alloc] initWithFrame:self.view.bounds];
    [self.view addSubview:text];
    // Do any additional setup after loading the view.
    ssh_session my_ssh_session = ssh_new();
    if (my_ssh_session == NULL)
      exit(-1);
    int port = 22;
    int verbosity = SSH_LOG_PROTOCOL;
    ssh_options_set(my_ssh_session, SSH_OPTIONS_USER, "joeleinbinder");

    ssh_options_set(my_ssh_session, SSH_OPTIONS_HOST, "192.168.1.144");
//    ssh_options_set(my_ssh_session, SSH_OPTIONS_LOG_VERBOSITY, &verbosity);
//    ssh_options_set(my_ssh_session, SSH_OPTIONS_PORT, &port);
    int rc = ssh_connect(my_ssh_session);
    if (rc != SSH_OK)
    {
      fprintf(stderr, "Error connecting to localhost: %s\n",
              ssh_get_error(my_ssh_session));
      exit(-1);
    }
    rc = ssh_userauth_password(my_ssh_session, NULL, "macbadger");
    if (rc != SSH_AUTH_SUCCESS)
    {
      fprintf(stderr, "Error authenticating with password: %s\n",
              ssh_get_error(my_ssh_session));
      ssh_disconnect(my_ssh_session);
      ssh_free(my_ssh_session);
      exit(-1);
    }

    NSString* output = show_remote_processes(my_ssh_session);
//    ssh_free(my_ssh_session);
    [text setText:output];
}


@end